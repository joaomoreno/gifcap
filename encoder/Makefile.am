bin_PROGRAMS = encoder
encoder_SOURCES = encoder.c
encoder_CFLAGS = $(LIBIMAGEQUANT_CFLAGS) -O3
encoder_LDADD = $(LIBIMAGEQUANT_LIBS)

# Emscripten specific flags
if EMSCRIPTEN
encoder_CFLAGS += -s WASM=1 -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' -s ALLOW_MEMORY_GROWTH=1
endif 