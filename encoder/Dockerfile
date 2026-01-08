FROM emscripten/emsdk:3.1.9
RUN apt update && apt install -y autoconf
ENTRYPOINT ["bash", "-c", "cd encoder && ./configure && make"]