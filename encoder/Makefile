CC=emcc
CFLAGS=-O2 -Ivendor/libimagequant
LIBS=vendor/libimagequant/*.o

encoder.js: encoder.c vendor/libimagequant/libimagequant.o
	$(CC) $(CFLAGS) -o $@ -s "EXPORTED_FUNCTIONS=['_main', '_encode']" encoder.c $(LIBS)

vendor/libimagequant/libimagequant.o:
	cd vendor/libimagequant && make static

.PHONY: clean

clean:
	cd vendor/libimagequant && make clean
	rm encoder.js