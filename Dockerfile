FROM ros:noetic-perception-focal

ARG ROS_VERSION=noetic
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

#Install LCM
RUN   git clone https://github.com/lcm-proj/lcm && \
      cd lcm && \
      git checkout tags/v1.4.0 && \
      mkdir build && cd build && \
      cmake -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=OFF -DBUILD_EXAMPLES=OFF -DBUILD_BENCHMARKS=OFF .. && \
      make -j$(nproc) install

#Build swarmtal_control
RUN   mkdir -p ${SWARM_WS}/src/ && \
      cd ${SWARM_WS}/src/ && \
      git clone https://github.com/HKUST-Swarm/swarm_msgs.git -b D2SLAM && \
      git clone https://github.com/HKUST-Swarm/bspline && \
      git clone https://github.com/HKUST-Swarm/inf_uwb_ros.git

RUN     . "/opt/ros/${ROS_VERSION}/setup.bash" && \
        cd ${SWARM_WS} && \
        catkin_make -DCMAKE_BUILD_TYPE=Release

WORKDIR /swarm_gcs
COPY ./ /swarm_gcs/
COPY ./entrypoint.sh /

ENTRYPOINT ["/entrypoint.sh"]
