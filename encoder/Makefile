CC=emcc
CFLAGS=-O2

encoder.js: encoder.c
	$(CC) $(CFLAGS) -o $@ $^

.PHONY: clean

clean:
	rm encoder.js