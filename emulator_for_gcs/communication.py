import socket
import mavlink_swarm as mavlink

class Communication:
    def __init__(self, config):
        self.client = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.PORT = config.get('port', 14550)
        self.HOST = config.get('host', '127.0.0.1')
        self.mavlink = mavlink.MAVLink(self.client)

    def send_mavlink_message(self, msg):
        buf = msg.pack(self.mavlink)
        self.client.sendto(buf, (self.HOST, self.PORT))

    def send_node_realtime_info(self, lps_time, odom_valid, x, y, z, vx, vy, vz, roll, pitch, yaw, remote_distance):
        """
        发送 NODE_REALTIME_INFO 消息

        参数:
        lps_time (int): LPS 时间戳，单位为毫秒
        odom_valid (bool): 里程计是否有效
        x (float): X 位置，单位为米
        y (float): Y 位置，单位为米
        z (float): Z 位置，单位为米
        vx (float): X 速度，单位为厘米/秒
        vy (float): Y 速度，单位为厘米/秒
        vz (float): Z 速度，单位为厘米/秒
        roll (float): 横滚角，单位为弧度*1000
        pitch (float): 俯仰角，单位为弧度*1000
        yaw (float): 偏航角，单位为弧度*1000
        remote_distance (list of float): 与远程无人机的距离，单位为米*1000
        """
        msg = self.mavlink.node_realtime_info_encode(
            lps_time,
            odom_valid,
            x,
            y,
            z,
            int(vx * 100),  # 转换为厘米/秒
            int(vy * 100),  # 转换为厘米/秒
            int(vz * 100),  # 转换为厘米/秒
            int(roll * 1000),  # 转换为弧度*1000
            int(pitch * 1000),  # 转换为弧度*1000
            int(yaw * 1000),  # 转换为弧度*1000
            [int(d * 1000) for d in remote_distance]  # 转换为米*1000
        )
        self.send_mavlink_message(msg)

    def send_drone_odom_gt(self, lps_time, source_id, x, y, z, q0, q1, q2, q3, vx, vy, vz):
        """
        发送 DRONE_ODOM_GT 消息

        参数:
        lps_time (int): LPS 时间戳，单位为毫秒
        source_id (int): 无人机的源ID
        x (float): X 位置，单位为米*1000
        y (float): Y 位置，单位为米*1000
        z (float): Z 位置，单位为米*1000
        q0 (float): 四元数 W，单位为米*10000
        q1 (float): 四元数 X，单位为米*10000
        q2 (float): 四元数 Y，单位为米*10000
        q3 (float): 四元数 Z，单位为米*10000
        vx (float): X 速度，单位为米*1000
        vy (float): Y 速度，单位为米*1000
        vz (float): Z 速度，单位为米*1000
        """
        msg = self.mavlink.drone_odom_gt_encode(
            lps_time,
            source_id,
            int(x * 1000),  # 转换为米*1000
            int(y * 1000),  # 转换为米*1000
            int(z * 1000),  # 转换为米*1000
            int(q0 * 10000),  # 转换为米*10000
            int(q1 * 10000),  # 转换为米*10000
            int(q2 * 10000),  # 转换为米*10000
            int(q3 * 10000),  # 转换为米*10000
            int(vx * 1000),  # 转换为米*1000
            int(vy * 1000),  # 转换为米*1000
            int(vz * 1000)  # 转换为米*1000
        )
        self.send_mavlink_message(msg)

    def send_drone_status(self, lps_time, flight_status, control_auth, commander_mode, input_mode, rc_valid, onboard_cmd_valid, sdk_valid, vo_valid, vo_latency, bat_vol, bat_remain, x, y, z, yaw):
        """
        发送 DRONE_STATUS 消息

        参数:
        lps_time (int): LPS 时间戳，单位为毫秒
        flight_status (int): 无人机飞行状态
        control_auth (int): 无人机控制权限
        commander_mode (int): 指挥官模式
        input_mode (int): 控制输入模式
        rc_valid (bool): 遥控器是否有效
        onboard_cmd_valid (bool): 机载命令是否有效
        sdk_valid (bool): SDK 是否有效
        vo_valid (bool): VO 是否有效
        vo_latency (float): VO 延迟
        bat_vol (float): 电池电压
        bat_remain (float): 电池剩余时间，单位为秒
        x (float): X 位置，单位为米
        y (float): Y 位置，单位为米
        z (float): Z 位置，单位为米
        yaw (float): 偏航角，单位为度
        """
        msg = self.mavlink.drone_status_encode(
            lps_time,
            flight_status,
            control_auth,
            commander_mode,
            input_mode,
            rc_valid,
            onboard_cmd_valid,
            sdk_valid,
            vo_valid,
            vo_latency,
            bat_vol,
            bat_remain,
            x,
            y,
            z,
            yaw
        )
        self.send_mavlink_message(msg)

    def send_node_relative_fused(self, lps_time, target_id, rel_x, rel_y, rel_z, rel_yaw_offset, cov_x, cov_y, cov_z, cov_yaw):
        """
        发送 NODE_RELATIVE_FUSED 消息

        参数:
        lps_time (int): LPS 时间戳，单位为毫秒
        target_id (int): 目标无人机的ID
        rel_x (float): 相对X位置，单位为米*1000
        rel_y (float): 相对Y位置，单位为米*1000
        rel_z (float): 相对Z位置，单位为米*1000
        rel_yaw_offset (float): 相对偏航角坐标偏移，单位为弧度*1000
        cov_x (float): X位置协方差，单位为米*1000
        cov_y (float): Y位置协方差，单位为米*1000
        cov_z (float): Z位置协方差，单位为米*1000
        cov_yaw (float): 偏航角协方差，单位为弧度*1000
        """
        msg = self.mavlink.node_relative_fused_encode(
            lps_time,
            target_id,
            int(rel_x * 1000),  # 转换为米*1000
            int(rel_y * 1000),  # 转换为米*1000
            int(rel_z * 1000),  # 转换为米*1000
            int(rel_yaw_offset * 1000),  # 转换为弧度*1000
            int(cov_x * 1000),  # 转换为米*1000
            int(cov_y * 1000),  # 转换为米*1000
            int(cov_z * 1000),  # 转换为米*1000
            int(cov_yaw * 1000)  # 转换为弧度*1000
        )
        self.send_mavlink_message(msg)

    def send_swarm_remote_command(self, lps_time, target_id, command_type, param1, param2, param3, param4, param5, param6, param7, param8, param9, param10):
        """
        发送 SWARM_REMOTE_COMMAND 消息

        参数:
        lps_time (int): LPS 时间戳，单位为毫秒
        target_id (int): 目标无人机的ID
        command_type (int): 机载命令类型
        param1 (int): 参数1
        param2 (int): 参数2
        param3 (int): 参数3
        param4 (int): 参数4
        param5 (int): 参数5
        param6 (int): 参数6
        param7 (int): 参数7
        param8 (int): 参数8
        param9 (int): 参数9
        param10 (int): 参数10
        """
        msg = self.mavlink.swarm_remote_command_encode(
            lps_time,
            target_id,
            command_type,
            param1,
            param2,
            param3,
            param4,
            param5,
            param6,
            param7,
            param8,
            param9,
            param10
        )
        self.send_mavlink_message(msg)

    def send_node_detected(self, lps_time, id, target_id, rel_x, rel_y, rel_z, rel_yaw, cov_x, cov_y, cov_z, cov_yaw):
        """
        发送 NODE_DETECTED 消息

        参数:
        lps_time (int): LPS 时间戳，单位为毫秒
        id (int): 消息ID检测
        target_id (int): 目标无人机的ID
        rel_x (float): 相对X位置，单位为米
        rel_y (float): 相对Y位置，单位为米
        rel_z (float): 相对Z位置，单位为米
        rel_yaw (float): 检测器的偏航角，单位为度
        cov_x (float): 相对X位置的协方差，单位为米
        cov_y (float): 相对Y位置的协方差，单位为米
        cov_z (float): 相对Z位置的协方差，单位为米
        cov_yaw (float): 检测器偏航角的协方差，单位为度
        """
        msg = self.mavlink.node_detected_encode(
            lps_time,
            id,
            target_id,
            rel_x,
            rel_y,
            rel_z,
            rel_yaw,
            cov_x,
            cov_y,
            cov_z,
            cov_yaw
        )
        self.send_mavlink_message(msg)

    def send_drone_pose_gt(self, lps_time, source_id, x, y, z, yaw):
        """
        发送 DRONE_POSE_GT 消息

        参数:
        lps_time (int): LPS 时间戳，单位为毫秒
        source_id (int): 无人机的源ID
        x (float): X 位置，单位为米*1000
        y (float): Y 位置，单位为米*1000
        z (float): Z 位置，单位为米*1000
        yaw (float): 偏航角，单位为弧度*1000
        """
        msg = self.mavlink.drone_pose_gt_encode(
            lps_time,
            source_id,
            int(x * 1000),  # 转换为米*1000
            int(y * 1000),  # 转换为米*1000
            int(z * 1000),  # 转换为米*1000
            int(yaw * 1000)  # 转换为弧度*1000
        )
        self.send_mavlink_message(msg)

    def send_node_local_fused(self, lps_time, target_id, x, y, z, yaw, cov_x, cov_y, cov_z, cov_yaw):
        """
        发送 NODE_LOCAL_FUSED 消息

        参数:
        lps_time (int): LPS 时间戳，单位为毫秒
        target_id (int): 目标无人机的ID
        x (float): X 位置，单位为米*1000
        y (float): Y 位置，单位为米*1000
        z (float): Z 位置，单位为米*1000
        yaw (float): 偏航角，单位为弧度*1000
        cov_x (float): X 位置协方差，单位为米*1000
        cov_y (float): Y 位置协方差，单位为米*1000
        cov_z (float): Z 位置协方差，单位为米*1000
        cov_yaw (float): 偏航角协方差，单位为弧度*1000
        """
        msg = self.mavlink.node_local_fused_encode(
            lps_time,
            target_id,
            int(x * 1000),  # 转换为米*1000
            int(y * 1000),  # 转换为米*1000
            int(z * 1000),  # 转换为米*1000
            int(yaw * 1000),  # 转换为弧度*1000
            int(cov_x * 1000),  # 转换为米*1000
            int(cov_y * 1000),  # 转换为米*1000
            int(cov_z * 1000),  # 转换为米*1000
            int(cov_yaw * 1000)  # 转换为弧度*1000
        )
        self.send_mavlink_message(msg)

    def send_node_based_fused(self, lps_time, target_id, rel_x, rel_y, rel_z, rel_yaw_offset, cov_x, cov_y, cov_z, cov_yaw):
        """
        发送 NODE_BASED_FUSED 消息

        参数:
        lps_time (int): LPS 时间戳，单位为毫秒
        target_id (int): 目标无人机的ID
        rel_x (float): 相对X位置，单位为米*1000
        rel_y (float): 相对Y位置，单位为米*1000
        rel_z (float): 相对Z位置，单位为米*1000
        rel_yaw_offset (float): 相对偏航角坐标偏移，单位为弧度*1000
        cov_x (float): X位置协方差，单位为米*1000
        cov_y (float): Y位置协方差，单位为米*1000
        cov_z (float): Z位置协方差，单位为米*1000
        cov_yaw (float): 偏航角协方差，单位为弧度*1000
        """
        msg = self.mavlink.node_based_fused_encode(
            lps_time,
            target_id,
            int(rel_x * 1000),  # 转换为米*1000
            int(rel_y * 1000),  # 转换为米*1000
            int(rel_z * 1000),  # 转换为米*1000
            int(rel_yaw_offset * 1000),  # 转换为弧度*1000
            int(cov_x * 1000),  # 转换为米*1000
            int(cov_y * 1000),  # 转换为米*1000
            int(cov_z * 1000),  # 转换为米*1000
            int(cov_yaw * 1000)  # 转换为弧度*1000
        )
        self.send_mavlink_message(msg)