#include <stdio.h>
#include <stdlib.h>
#include <libimagequant.h>
#include <lcdfgif/gif.h>
#include <gifsicle.h>
#include <emscripten.h>

// #include <time.h>
// clock_t c;
// #define TIMESTAMP(name)                                                       \
//   printf("  %s %f\n", name, ((double)(clock() - c) / CLOCKS_PER_SEC * 1000)); \
//   c = clock();

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

EMSCRIPTEN_KEEPALIVE
void encoder_new_frame(int id, int width, int height, void *image_data, int delay, void (*cb)(void *, int))
{
  liq_attr *attr = liq_attr_create();
  liq_image *raw_image = liq_image_create_rgba(attr, image_data, width, height, 0);
  liq_result *res = liq_quantize_image(attr, raw_image);
  liq_attr_destroy(attr);

  const liq_palette *palette = liq_get_palette(res);
  Gif_Stream *stream = Gif_NewStream();
  stream->screen_width = width;
  stream->screen_height = height;
  stream->loopcount = 0;

  Gif_Image *image = Gif_NewImage();
  image->width = width;
  image->height = height;
  image->delay = delay;
  image->local = create_colormap_from_palette(palette);
  Gif_CreateUncompressedImage(image, 0);
  liq_write_remapped_image(res, raw_image, image->image_data, width * height);
  liq_result_destroy(res);
  liq_image_destroy(raw_image);

  Gif_CompressInfo compress_info = {.flags = 0, .loss = 20};
  Gif_FullCompressImage(stream, image, &compress_info);
  Gif_ReleaseUncompressedImage(image);

  Gif_Writer *writer = Gif_NewMemoryWriter(&compress_info);
  Gif_IncrementalWriteImage(writer, stream, image);

  cb(writer->v, writer->pos);

  Gif_DeleteMemoryWriter(writer);
  Gif_DeleteImage(image);
  Gif_DeleteStream(stream);
}