#!/bin/bash

npm run typeorm -- migration:run
exec "$@"