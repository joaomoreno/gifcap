CC=emcc
CFLAGS=-O2 -Ivendor/libimagequant
LIBS=vendor/libimagequant/*.o

encoder.js: encoder.c
	$(CC) $(CFLAGS) -o $@ -s "EXPORTED_FUNCTIONS=['_main', '_encode']" $^ $(LIBS)

.PHONY: clean

clean:
	rm encoder.js