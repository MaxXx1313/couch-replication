
# Usage

```bash
# replicate
node index replicate -p 'current-develop_ffa_' -s http://admin:admin@172.16.16.84:5984 -t http://admin:admin@172.16.16.84:5986

# delete all (BE CARREFUL!)
node index delete -p 'current-develop_ffa_' -t http://admin:admin@172.16.16.84:5986

# list active replications
node index list -p 'current-develop_ffa_' -t http://admin:admin@172.16.16.84:5986

# databases list
node index dblist -p 'current-develop_ffa_' -t http://admin:admin@172.16.16.84:5984
```

## TODO

* replication progress
* remove all (oh my god!)