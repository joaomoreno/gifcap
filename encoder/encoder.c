#include <stdio.h>
#include <stdlib.h>
#include <libimagequant.h>
#include <lcdfgif/gif.h>
#include <gifsicle.h>

int main()
{
  return 0;
}

unsigned int encode(void *one, void *two, void *three, int width, int height)
{
  liq_attr *attr = liq_attr_create();
  liq_image *image_one = liq_image_create_rgba(attr, one, width, height, 0);
  liq_image *image_two = liq_image_create_rgba(attr, two, width, height, 0);
  liq_image *image_three = liq_image_create_rgba(attr, three, width, height, 0);

  liq_histogram *histogram = liq_histogram_create(attr);
  liq_histogram_add_image(histogram, attr, image_one);
  liq_histogram_add_image(histogram, attr, image_two);
  liq_histogram_add_image(histogram, attr, image_three);

  liq_result *res;
  liq_error err = liq_histogram_quantize(histogram, attr, &res);

  Gif_Image *gif_image_one = Gif_NewImage();
  gif_image_one->width = width;
  gif_image_one->height = height;
  gif_image_one->delay = 100;
  Gif_CreateUncompressedImage(gif_image_one, 0);
  liq_write_remapped_image(res, image_one, gif_image_one->image_data, width * height);

  Gif_Image *gif_image_two = Gif_NewImage();
  gif_image_two->width = width;
  gif_image_two->height = height;
  gif_image_two->delay = 100;
  Gif_CreateUncompressedImage(gif_image_two, 0);
  liq_write_remapped_image(res, image_two, gif_image_two->image_data, width * height);

  Gif_Image *gif_image_three = Gif_NewImage();
  gif_image_three->width = width;
  gif_image_three->height = height;
  gif_image_three->delay = 100;
  Gif_CreateUncompressedImage(gif_image_three, 0);
  liq_write_remapped_image(res, image_three, gif_image_three->image_data, width * height);

  const liq_palette *pal = liq_get_palette(res);
  Gif_Colormap *colormap = Gif_NewFullColormap(pal->count, pal->count);

  for (int i = 0; i < pal->count; i++)
  {
    liq_color color = pal->entries[i];
    colormap->col[i].pixel = 256;
    colormap->col[i].gfc_red = color.r;
    colormap->col[i].gfc_green = color.g;
    colormap->col[i].gfc_blue = color.b;
    colormap->col[i].haspixel = 1;
  }

  liq_result_destroy(res);
  liq_histogram_destroy(histogram);
  liq_image_destroy(one);
  liq_image_destroy(two);
  liq_image_destroy(three);
  liq_attr_destroy(attr);

  Gif_Stream *gif_stream = Gif_NewStream();
  gif_stream->screen_width = width;
  gif_stream->screen_height = height;
  gif_stream->global = colormap;
  gif_stream->global->refcount = 1;
  gif_stream->loopcount = 0;

  Gif_AddImage(gif_stream, gif_image_one);
  Gif_AddImage(gif_stream, gif_image_two);
  Gif_AddImage(gif_stream, gif_image_three);

  Gif_CompressInfo gif_write_info;
  Gif_InitCompressInfo(&gif_write_info);
  gif_write_info.loss = 20;

  FILE *file = fopen("/output.gif", "wb");
  Gif_FullWriteFile(gif_stream, &gif_write_info, file);
  fclose(file);

  Gif_Delete(gif_stream);
  Gif_Delete(gif_image_one);
  Gif_Delete(colormap);

  return 0;
}