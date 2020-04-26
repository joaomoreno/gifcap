#include <stdio.h>
#include <stdlib.h>
#include <libimagequant.h>
#include <lcdfgif/gif.h>

int main()
{
  printf("hello, world!\n");
  return 0;
}

unsigned int encode(void *raw_image_data, int width, int height)
{
  liq_attr *attr = liq_attr_create();
  liq_image *image = liq_image_create_rgba(attr, raw_image_data, width, height, 0);
  liq_result *res;
  liq_image_quantize(image, attr, &res);

  Gif_Image *gif_image = Gif_NewImage();
  gif_image->width = width;
  gif_image->height = height;
  Gif_CreateUncompressedImage(gif_image, 0);

  liq_error err = liq_write_remapped_image(res, image, gif_image->image_data, width * height);

  const liq_palette *pal = liq_get_palette(res);

  printf("ncolors: %d\n", pal->count);

  Gif_Colormap *gif_colormap = Gif_NewFullColormap(pal->count, pal->count);

  for (int i = 0; i < pal->count; i++)
  {
    liq_color color = pal->entries[i];
    gif_colormap->col[i].gfc_red = color.r;
    gif_colormap->col[i].gfc_green = color.g;
    gif_colormap->col[i].gfc_blue = color.b;
    gif_colormap->col[i].haspixel = 0;
    // printf("color: %d %d %d %d\n", i, color.r, color.g, color.b);
  }

  Gif_Stream *gif_stream = Gif_NewStream();
  gif_stream->global = gif_colormap;
  gif_stream->global->refcount = 1;
  gif_stream->screen_width = width;
  gif_stream->screen_height = height;

  Gif_AddImage(gif_stream, gif_image);

  FILE *file = fopen("/output.gif", "wb");
  Gif_WriteFile(gif_stream, file);
  fclose(file);

  return pal->count;

  // liq_result_destroy(res);
  // liq_image_destroy(image);
  // liq_attr_destroy(attr);
}