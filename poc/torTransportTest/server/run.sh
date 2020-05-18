RUNCOMMAND="docker container run -it -p 4001:4000 -p 9229:9229 islands:torTestServer"
docker build -f Dockerfile -t islands:torTestServer .
eval "$RUNCOMMAND"
