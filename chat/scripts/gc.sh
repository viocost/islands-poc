mv per  #!/bin/bash

echo submitting changes to github!

echo Enter message for git commit:
read MESSAGE

echo Increment software version? Y/n

read INCREMENT

if echo $INCREMENT | grep -iqF y; then
    echo executing version update script
    node ./scripts/updateVersion.js -p "$(readlink -f package.json)"
fi

echo Your message: $MESSAGE
git add -A
git commit -m "$MESSAGE"
git push origin HEAD
