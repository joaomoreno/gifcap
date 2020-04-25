#include <stdio.h>
#include <stdlib.h>
#include <libimagequant.h>

int main()
{
  printf("hello, world!\n");
  return 0;
}

unsigned int encode(void *image_data, int width, int height)
{
  liq_attr *attr = liq_attr_create();
  liq_image *image = liq_image_create_rgba(attr, image_data, width, height, 0);
  liq_result *res;
  liq_image_quantize(image, attr, &res);

  size_t buffer_size = width * height;
  void *buffer = malloc(buffer_size);

  liq_write_remapped_image(res, image, buffer, buffer_size);
  const liq_palette *pal = liq_get_palette(res);

  // Save the image and the palette now.
  // for (int i = 0; i < pal->count; i++)
  // {
  //   liq_color color = pal->entries[i];
  //   printf("color %u %u %u %u\n", color.r, color.g, color.b, color.a);
  // }

  return pal->count;

  // // You'll need a PNG library to write to a file.
  // example_write_image(example_bitmap_8bpp);

  // liq_result_destroy(res);
  // liq_image_destroy(image);
  // liq_attr_destroy(attr);
}