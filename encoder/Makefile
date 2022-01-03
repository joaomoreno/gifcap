CC=emcc
CFLAGS=-O2 \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s RESERVED_FUNCTION_POINTERS=20 \
	-s ALLOW_TABLE_GROWTH=1 \
	-s EXPORTED_FUNCTIONS=['_malloc','_free'] \
	-s EXPORTED_RUNTIME_METHODS=['addFunction'] \
	-Ivendor/libimagequant \
	-Ivendor/gifsicle/src \
	-Ivendor/gifsicle/include
LIBIMAGEQUANT_LIBS=vendor/libimagequant/blur.o \
	vendor/libimagequant/kmeans.o \
	vendor/libimagequant/libimagequant.o \
	vendor/libimagequant/mediancut.o \
	vendor/libimagequant/mempool.o \
	vendor/libimagequant/nearest.o \
	vendor/libimagequant/pam.o
GIFSICLE_LIBS=vendor/gifsicle/src/giffunc.o \
	vendor/gifsicle/src/fmalloc.o \
	vendor/gifsicle/src/support.o \
	vendor/gifsicle/src/gifwrite.o \
	vendor/gifsicle/src/gifread.o

encoder.js: encoder.c vendor/libimagequant/libimagequant.o vendor/gifsicle/src/giffunc.o vendor/gifsicle/src/fmalloc.o vendor/gifsicle/src/support.o vendor/gifsicle/src/gifwrite.o vendor/gifsicle/src/gifread.o
	$(CC) $(CFLAGS) -o $@ encoder.c $(LIBIMAGEQUANT_LIBS) $(GIFSICLE_LIBS)

$(LIBIMAGEQUANT_LIBS):
	cd vendor/libimagequant && make static

$(GIFSICLE_LIBS):
	cd vendor/gifsicle/src && make giffunc.o fmalloc.o support.o gifwrite.o gifread.o

.PHONY: clean

clean:
	cd vendor/libimagequant && make clean
	cd vendor/gifsicle && make clean
	rm -f encoder.js encoder.wasm