RUNCOMMAND="docker container run -it islands:torTestClient"
docker build -f Dockerfile -t islands:torTestClient .
eval "$RUNCOMMAND"
npm i request