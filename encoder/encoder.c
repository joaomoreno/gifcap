#include <stdio.h>
#include <stdlib.h>
#include <libimagequant.h>
#include <lcdfgif/gif.h>
#include <gifsicle.h>
#include <emscripten.h>
#include <string.h>

typedef struct encoder
{
  liq_attr *attr;
  Gif_Stream *stream;
  int width;
  int height;

  Gif_CompressInfo *compress_info;
  FILE *file;
  Gif_Writer *writer;
} encoder;

EMSCRIPTEN_KEEPALIVE
encoder *encoder_new(int width, int height)
{
  Gif_Stream *stream = Gif_NewStream();
  stream->screen_width = width;
  stream->screen_height = height;
  stream->loopcount = 0;

  Gif_CompressInfo *compress_info = malloc(sizeof(Gif_CompressInfo));
  Gif_InitCompressInfo(compress_info);
  compress_info->loss = 20;
  FILE *file = fopen("/output.gif", "wb");
  Gif_Writer *writer = Gif_IncrementalWriteFileInit(stream, compress_info, file);

  encoder *result = malloc(sizeof(encoder));
  result->attr = liq_attr_create();
  result->stream = stream;
  result->width = width;
  result->height = height;
  result->compress_info = compress_info;
  result->file = file;
  result->writer = writer;
  return result;
}

inline Gif_Colormap *create_colormap_from_palette(const liq_palette *palette)
{
  Gif_Colormap *colormap = Gif_NewFullColormap(palette->count, palette->count);

  for (int i = 0; i < palette->count; i++)
  {
    liq_color color = palette->entries[i];
    colormap->col[i].pixel = 256;
    colormap->col[i].gfc_red = color.r;
    colormap->col[i].gfc_green = color.g;
    colormap->col[i].gfc_blue = color.b;
    colormap->col[i].haspixel = 1;
  }

  return colormap;
}

// #define TIMESTAMP(name)                                                       \
//   printf("  %s %f\n", name, ((double)(clock() - c) / CLOCKS_PER_SEC * 1000)); \
//   c = clock();

EMSCRIPTEN_KEEPALIVE
void encoder_add_frame(encoder *enc, void *image_data, int delay)
{
  liq_image *raw_image = liq_image_create_rgba(enc->attr, image_data, enc->width, enc->height, 0);
  liq_result *res = liq_quantize_image(enc->attr, raw_image); // HEAVY
  const liq_palette *palette = liq_get_palette(res);

  Gif_Image *image = Gif_NewImage();
  image->width = enc->width;
  image->height = enc->height;
  image->delay = delay;
  image->local = create_colormap_from_palette(palette);

  Gif_CreateUncompressedImage(image, 0);
  liq_write_remapped_image(res, raw_image, image->image_data, enc->width * enc->height); // HEAVY
  Gif_CompressImage(enc->stream, image);
  Gif_ReleaseUncompressedImage(image);
  Gif_IncrementalWriteImage(enc->writer, enc->stream, image);

  Gif_DeleteImage(image);
  liq_result_destroy(res);
  liq_image_destroy(raw_image);
}

EMSCRIPTEN_KEEPALIVE
void encoder_encode(encoder *enc)
{
  Gif_IncrementalWriteComplete(enc->writer, enc->stream);
  fclose(enc->file);
  Gif_DeleteStream(enc->stream);
  liq_attr_destroy(enc->attr);
  free(enc);
}