FROM debian:bullseye AS base

WORKDIR /usr/src/app

COPY .  .

RUN apt update
RUN apt install wget curl unzip -y
RUN wget https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-2/wkhtmltox_0.12.6.1-2.bullseye_amd64.deb
RUN apt install -y ./wkhtmltox_0.12.6.1-2.bullseye_amd64.deb
RUN curl -fsSL https://bun.com/install | bash
RUN ~/.bun/bin/bun index.ts /usr/local/bin/wkhtmltopdf

FROM scratch AS runtime

ENV PATH=/usr/local/bin
ENV PATHEXT=/usr/local/bin
ENV WKHTMLTOPDF_PATH=/usr/local/bin

COPY --from=base /usr/share/fonts /usr/share/fonts
COPY --from=base /usr/share/fonts /usr/local/share/fonts
COPY --from=base /usr/src/app/libs /