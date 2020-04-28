#include <stdio.h>
#include <stdlib.h>
#include <libimagequant.h>
#include <lcdfgif/gif.h>
#include <gifsicle.h>
#include <emscripten.h>
#include <string.h>

typedef struct frame
{
  liq_image *image;
  int delay;
} frame;

typedef struct encoder
{
  liq_attr *attr;
  frame **frames;
  int frame_count;
  int frame_cap;
  int width;
  int height;
} encoder;

EMSCRIPTEN_KEEPALIVE
encoder *encoder_new(int width, int height)
{
  encoder *result = malloc(sizeof(encoder));
  result->attr = liq_attr_create();
  result->frames = calloc(10, sizeof(liq_image *));
  result->frame_count = 0;
  result->frame_cap = 10;
  result->width = width;
  result->height = height;
  return result;
}

EMSCRIPTEN_KEEPALIVE
void encoder_add_frame(encoder *enc, void *image_data, int delay)
{
  if (enc->frame_cap == enc->frame_count)
  {
    int cap = enc->frame_cap * 2;
    frame **frames = calloc(cap, sizeof(frame *));
    memcpy(frames, enc->frames, enc->frame_cap * sizeof(frame *));
    free(enc->frames);
    enc->frames = frames;
    enc->frame_cap = cap;
  }

  frame *f = malloc(sizeof(frame));
  f->image = liq_image_create_rgba(enc->attr, image_data, enc->width, enc->height, 0);
  f->delay = delay;

  enc->frames[enc->frame_count++] = f;
}

EMSCRIPTEN_KEEPALIVE
void encoder_encode(encoder *enc)
{
  liq_histogram *histogram = liq_histogram_create(enc->attr);

  for (int i = 0; i < enc->frame_count; i++)
  {
    liq_histogram_add_image(histogram, enc->attr, enc->frames[i]->image);
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

  Gif_Stream *stream = Gif_NewStream();
  stream->screen_width = enc->width;
  stream->screen_height = enc->height;
  stream->global = colormap;
  stream->global->refcount = 1;
  stream->loopcount = 0;

  for (int i = 0; i < enc->frame_count; i++)
  {
    Gif_Image *image = Gif_NewImage();
    image->width = enc->width;
    image->height = enc->height;
    image->delay = enc->frames[i]->delay;
    Gif_CreateUncompressedImage(image, 0);
    liq_write_remapped_image(res, enc->frames[i]->image, image->image_data, enc->width * enc->height);
    Gif_AddImage(stream, image);
    liq_image_destroy(enc->frames[i]->image);
    free(enc->frames[i]);
  }

  liq_result_destroy(res);
  liq_histogram_destroy(histogram);
  liq_attr_destroy(enc->attr);
  free(enc->frames);
  enc->frame_count = 0;
  enc->frame_cap = 0;

  Gif_CompressInfo info;
  Gif_InitCompressInfo(&info);
  info.loss = 20;

  FILE *file = fopen("/output.gif", "wb");
  Gif_FullWriteFile(stream, &info, file);
  fclose(file);

  Gif_DeleteStream(stream);
}

EMSCRIPTEN_KEEPALIVE
void encoder_free(encoder *enc)
{
  free(enc->frames);
  free(enc);
}