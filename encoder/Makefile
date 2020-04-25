CC=emcc
CFLAGS=-O2 -Ivendor/libimagequant
LIBS=vendor/libimagequant/*.o

encoder.js: encoder.c vendor/libimagequant/libimagequant.o vendor/gifsicle/gifsicle.o
	$(CC) $(CFLAGS) -o $@ -s "EXPORTED_FUNCTIONS=['_main', '_encode']" encoder.c $(LIBS)

vendor/libimagequant/libimagequant.o:
	cd vendor/libimagequant && make static

vendor/gifsicle/gifsicle.o:
	cd vendor/gifsicle && make

.PHONY: clean

clean:
	cd vendor/libimagequant && make clean
	cd vendor/gifsicle && make clean
	rm encoder.js