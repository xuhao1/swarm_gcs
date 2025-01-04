FROM ros:iron-perception

ARG ROS_VERSION=iron
ARG SWARM_WS=/root/gcs_ws
ARG NODEJS_VERSION=23

SHELL ["/bin/bash", "-c"]

# Install nodejs using fnm

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y git ros-${ROS_VERSION}-rosbridge-suite libglib2.0-dev curl unzip

RUN curl -fsSL https://fnm.vercel.app/install | bash
RUN bash -i -c "fnm install ${NODEJS_VERSION} && fnm use ${NODEJS_VERSION}" && \
    bash -i -c " npm --version"

RUN bash -i -c "npm install -g http-server"

#Build swarmtal_control
RUN   mkdir -p ${SWARM_WS}/src/ && \
      cd ${SWARM_WS}/src/ && \
      git clone https://github.com/HKUST-Swarm/bspline.git -b ros2 && \
      git clone https://github.com/HKUST-Swarm/swarm_msgs.git -b ros2

RUN     . "/opt/ros/${ROS_VERSION}/setup.bash" && \
      cd ${SWARM_WS} && \
      colcon build

WORKDIR /swarm_gcs
COPY ./ /swarm_gcs/
COPY ./entrypoint.sh /

ENTRYPOINT ["/entrypoint.sh"]
