#!/bin/bash

npm run build

# if [ $# -eq 1 ]
# then
#   surge public https://xiaohk-gam-changer-$1.surge.sh
# else
#   surge public https://xiaohk-gam-changer.surge.sh
# fi

cd public
vercel
cd ..

# vercel alias https://gam-changer-e1gaga9qe-xiaohk.vercel.app user-study-xiaohk.vercel.app