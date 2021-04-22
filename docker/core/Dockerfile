# FIXME use alpine
FROM node:14

RUN mkdir -p /usr/app/src \
	&& mkdir -p /usr/app/media \
	&& mkdir -p /usr/app/scripts \
	&& apt-get update \
  && apt-get install netcat -y

WORKDIR /usr/app/src

COPY package.json /usr/app/src

RUN chown -R node:node /usr/app

USER node

ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH="/home/node/.npm-global/bin:${PATH}"

# FIXME no need for nodemon
RUN npm install -g --loglevel warn nodemon bunyan \
    && npm cache clean --force \
    && npm install --loglevel warn

COPY --chown=node:node ./docker/core/bootstrap.sh /usr/app/scripts/bootstrap.sh
COPY --chown=node:node ./docker/core/wait.sh /usr/app/scripts/wait.sh
COPY --chown=node:node . /usr/app/src
RUN mkdir /usr/app/src/state


ENTRYPOINT [ "/usr/app/scripts/bootstrap.sh" ]
CMD ["nodemon -e 'js,json' lib/run.js"]

EXPOSE 8084
