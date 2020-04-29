Build libimagequant:

```
cd vendor/libimagequant
./configure --disable-sse CC=emcc
make static
emcc -O2 libimagequant.o -o libimagequant.js
```