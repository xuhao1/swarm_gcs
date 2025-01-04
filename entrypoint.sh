#!/bin/bash
# If argument1 is launch: to launch all nodes, else may in exec mode

source /root/gcs_ws/install/setup.bash
eval "$(/root/.local/share/fnm/fnm env --shell=bash)"
echo "Launching with argument $1"
if [ "$1" == "launch" ]; then
    echo "Launching GCS"
    ros2 launch rosbridge_server rosbridge_websocket_launch.xml &
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
