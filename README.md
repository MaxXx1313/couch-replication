
# Usage

```bash
# replicate
node index replicate -p 'current-develop_ffa_' -s http://admin:admin@172.16.16.84:5984 -t http://admin:admin@172.16.16.84:5986  --withusers --newprefix 'test1-'

# delete all (BE CARREFUL!)
node index removeall -p 'current-develop_ffa_' -t http://admin:admin@172.16.16.84:5986

# list active replications
node index list -p 'current-develop_ffa_' -t http://admin:admin@172.16.16.84:5986

# databases list
node index dblist -p 'current-develop_ffa_' -t http://admin:admin@172.16.16.84:5984


# copy users
node index copyusers -p 'current-develop_ffa_' -s http://admin:admin@172.16.16.84:5984 -t http://admin:admin@172.16.16.84:5986 --newprefix 'tets3-'

# run agent task for EXT/INT db
# 'source' is a main db location
node index agent_ext -p 'current-develop_ffa_' -t http://admin:admin@172.16.16.84:5984

node index agent_ext -p 'current-develop_ffa_' -t http://admin:admin@172.16.16.84:5984 -s http://admin:admin@172.16.16.84:5986


node index agent_int -p 'current-develop_ffa_' -t http://admin:admin@172.16.16.84:5984

node index agent_int -p 'current-develop_ffa_' -t http://admin:admin@172.16.16.84:5984 -s http://admin:admin@172.16.16.84:5986

```

