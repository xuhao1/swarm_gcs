#!/bin/bash
# If argument1 is launch: to launch all nodes, else may in exec mode

source /root/gcs_ws/devel/setup.bash
eval "$(fnm env --shell=bash)"
echo "Launching with argument $1"
if [ "$1" == "launch" ]; then
    echo "Launching GCS"
    sudo ifconfig eth0 multicast
    sudo route add -net 224.0.0.0 netmask 240.0.0.0 dev eth0
    roslaunch inf_uwb_ros uwb_node_gcs.launch &
    echo "Launching GCS UI"
    npm run web --prefix /swarm_gcs
    LOCAL_IP=$(hostname -I)
    echo "Start GCS Finished, visit http://$LOCAL_IP:8080"
else if [ "$1" == "bash" ]; then
    /bin/bash
else
    # exec with all arguments
    exec "$@"
fi
fi
