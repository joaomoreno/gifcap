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
  gif_image->image_data = Gif_NewArray(uint8_t, width * height);
  gif_image->free_image_data = Gif_Free;

  liq_error err = liq_write_remapped_image(res, image, gif_image->image_data, width * height);

  printf("first: %d %d %d %d %d %d %d %d %d %d %d\n", gif_image->image_data[0], gif_image->image_data[1], gif_image->image_data[2], gif_image->image_data[3], gif_image->image_data[4], gif_image->image_data[5], gif_image->image_data[6], gif_image->image_data[7], gif_image->image_data[8], gif_image->image_data[9], gif_image->image_data[10]);

  const liq_palette *pal = liq_get_palette(res);

  printf("ncolors: %d\n", pal->count);

  Gif_Colormap *gif_colormap = Gif_NewFullColormap(pal->count, pal->count);

  for (int i = 0; i < pal->count; i++)
  {
    liq_color color = pal->entries[i];
    gif_colormap->col[i].gfc_red = color.r;
    gif_colormap->col[i].gfc_green = color.g;
    gif_colormap->col[i].gfc_blue = color.b;
  }

  gif_image->local = gif_colormap;

  Gif_Stream *gif_stream = Gif_NewStream();
  Gif_AddImage(gif_stream, gif_image);

  FILE *file = fopen("/output.gif", "wb");
  Gif_WriteFile(gif_stream, file);
  fclose(file);

  return pal->count;

  // liq_result_destroy(res);
  // liq_image_destroy(image);
  // liq_attr_destroy(attr);
}