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
  liq_image **images;
  int image_count;
  int image_cap;
  int width;
  int height;
} encoder;

EMSCRIPTEN_KEEPALIVE
encoder *encoder_new(int width, int height)
{
  encoder *result = malloc(sizeof(encoder));
  result->attr = liq_attr_create();
  result->images = calloc(10, sizeof(liq_image *));
  result->image_count = 0;
  result->image_cap = 10;
  result->width = width;
  result->height = height;
  return result;
}

EMSCRIPTEN_KEEPALIVE
void encoder_add_frame(encoder *enc, void *image_data)
{
  if (enc->image_cap == enc->image_count)
  {
    int cap = enc->image_cap * 2;
    liq_image **images = calloc(cap, sizeof(liq_image *));
    memcpy(images, enc->images, enc->image_cap * sizeof(liq_image *));
    free(enc->images);
    enc->images = images;
    enc->image_cap = cap;
  }

  enc->images[enc->image_count++] = liq_image_create_rgba(enc->attr, image_data, enc->width, enc->height, 0);
}

EMSCRIPTEN_KEEPALIVE
void encoder_encode(encoder *enc)
{
  liq_histogram *histogram = liq_histogram_create(enc->attr);

  for (int i = 0; i < enc->image_count; i++)
  {
    liq_histogram_add_image(histogram, enc->attr, enc->images[i]);
  }

  liq_result *res;
  liq_error err = liq_histogram_quantize(histogram, enc->attr, &res);

  const liq_palette *palette = liq_get_palette(res);
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

  Gif_Stream *gif_stream = Gif_NewStream();
  gif_stream->screen_width = enc->width;
  gif_stream->screen_height = enc->height;
  gif_stream->global = colormap;
  gif_stream->global->refcount = 1;
  gif_stream->loopcount = 0;

  for (int i = 0; i < enc->image_count; i++)
  {
    Gif_Image *image = Gif_NewImage();
    image->width = enc->width;
    image->height = enc->height;
    image->delay = 100;
    Gif_CreateUncompressedImage(image, 0);
    liq_write_remapped_image(res, enc->images[i], image->image_data, enc->width * enc->height);
    Gif_AddImage(gif_stream, image);
  }

  Gif_CompressInfo info;
  Gif_InitCompressInfo(&info);
  info.loss = 20;

  FILE *file = fopen("/output.gif", "wb");
  Gif_FullWriteFile(gif_stream, &info, file);
  fclose(file);
}

EMSCRIPTEN_KEEPALIVE
void encoder_free(encoder *enc)
{
  free(enc->images);
  free(enc);
}