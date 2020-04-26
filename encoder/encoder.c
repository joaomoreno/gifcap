#include <stdio.h>
#include <stdlib.h>
#include <libimagequant.h>
#include <lcdfgif/gif.h>

int main()
{
  return 0;
}

unsigned int encode(void *raw_image_data, int width, int height)
{
  liq_attr *attr = liq_attr_create();
  liq_image *image = liq_image_create_rgba(attr, raw_image_data, width, height, 0);
  liq_result *res;
  liq_error err = liq_image_quantize(image, attr, &res);

  Gif_Image *gif_image = Gif_NewImage();
  gif_image->width = width;
  gif_image->height = height;
  Gif_CreateUncompressedImage(gif_image, 0);

  liq_write_remapped_image(res, image, gif_image->image_data, width * height);

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
  }

  liq_result_destroy(res);
  liq_image_destroy(image);
  liq_attr_destroy(attr);

  gif_image->local = gif_colormap;
  gif_image->local->refcount = 1;

  Gif_Stream *gif_stream = Gif_NewStream();
  gif_stream->screen_width = width;
  gif_stream->screen_height = height;

  Gif_AddImage(gif_stream, gif_image);

  Gif_CompressInfo gif_write_info;
  Gif_InitCompressInfo(&gif_write_info);
  gif_write_info.loss = 20;

  FILE *file = fopen("/output.gif", "wb");
  Gif_FullWriteFile(gif_stream, &gif_write_info, file);
  fclose(file);

  Gif_Delete(gif_stream);
  Gif_Delete(gif_image);
  Gif_Delete(gif_colormap);

  return pal->count;
}