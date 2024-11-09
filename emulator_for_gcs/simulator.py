import time
import math
from utils import euler_to_quaternion, quaternion_to_euler

ctrl_auths = ["RC", "APP", "ONBOARD"]
ctrl_modes = [
    "IDLE",
    "TAKEOFF",
    "LANDING",
    "HOVER",
    "POSVEL",
    "ATT",
    "MISSION",
    "ALTCTL",
]
all_flight_status = ["DISARMED", "ARMED", "INAIR", "CRASHED"]
ctrl_input_mode = ["NONE", "RC", "ONBOARD"]


class DroneSimulator:
    def __init__(self, config, communication):
        self.communication = communication
        self.status = 0  # 初始状态为地面
        self.position = [0, 0, 0]  # [x, y, z]
        self.velocity = [0, 0, 0]  # [vx, vy, vz]
        self.orientation = [1, 0, 0, 0]  # [w, x, y, z]
        self.euler = [0, 0, 0]  # [roll, pitch, yaw]
        self.radius = config.get("radius", 10)  # 圆周运动的半径
        self.height = config.get("height", 10)  # 飞行高度
        self.angular_velocity = [0, 0, config.get("angularVelocity", math.pi / 50)]  # [wx, wy, wz]
        self.lps_time = 0  # 模拟的时间戳
        self.battery_voltage = config.get("initialVoltage", 12.6)  # 初始电池电压
        self.final_voltage = config.get("finalVoltage", 10.5)  # 末尾电池电压
        self.flight_time = config.get("flightTime", 30000)  # 飞行时间
        self.angle = 0  # 当前角度
        self.odom_valid = False  # 初始odom_vaild为false
        self.remote_uwb_distances = [0 for _ in range(10)]  # 10个uwb的距离
        self.takeoff_time = config.get("takeoffTime", 5)  # 起飞时间，单位为秒
        self.landing_time = config.get("landingTime", 5)  # 降落时间，单位为秒
        self.circle_period = config.get("circlePeriod", 60)  # 转圈周期，单位为秒

    def send_status(self):
        self.communication.send_node_realtime_info(
            self.lps_time,
            self.odom_valid,
            self.position[0],
            self.position[1],
            self.position[2],
            self.velocity[0],
            self.velocity[1],
            self.velocity[2],
            self.euler[0],
            self.euler[1],
            self.euler[2],
            self.remote_uwb_distances,
        )
        self.communication.send_drone_odom_gt(
            self.lps_time,
            1,
            self.position[0],
            self.position[1],
            self.position[2],
            self.orientation[0],
            self.orientation[1],
            self.orientation[2],
            self.orientation[3],
            self.velocity[0],
            self.velocity[1],
            self.velocity[2],
        )
        self.communication.send_drone_status(
            self.lps_time,
            self.flight_status,
            self.control_auth,
            self.commander_mode,
            self.input_mode,
            True,
            True,
            True,
            True,
            0,
            self.battery_voltage,
            100,
            self.position[0],
            self.position[1],
            self.position[2],
            self.euler[2],
        )

    def start(self):
        self.status = 1  # ARMING
        self.flight_status = 1  # ARMED
        self.control_auth = 0  # RC
        self.commander_mode = 1  # TAKEOFF
        self.input_mode = 1  # RC
        self.odom_valid = False

        print(
            f"Flight Status: {all_flight_status[self.flight_status]}, Commander Mode: {ctrl_modes[self.commander_mode]}"
        )
        self.send_status()
        self.takeoff()

    def takeoff(self):
        start_time = time.time()
        while time.time() - start_time < self.takeoff_time:
            self.lps_time += 10  # 模拟时间戳增加
            self.position[2] = (time.time() - start_time) / self.takeoff_time * self.height  # 逐渐上升到目标高度
            self.send_status()
            time.sleep(0.1)  # 每0.1秒更新一次

        self.hover()

    def hover(self):
        self.status = 2  # FLYING
        self.flight_status = 2  # INAIR
        self.commander_mode = 3  # HOVER
        self.odom_valid = True
        print(
            f"Flight Status: {all_flight_status[self.flight_status]}, Commander Mode: {ctrl_modes[self.commander_mode]}"
        )
        self.send_status()

    def mission(self):
        self.commander_mode = 6  # MISSION
        print(
            f"Flight Status: {all_flight_status[self.flight_status]}, Commander Mode: {ctrl_modes[self.commander_mode]}"
        )
        self.send_status()

    def fly(self):
        self.lps_time += 10  # 模拟时间戳增加
        self.angle += 2 * math.pi / (self.circle_period * 100)  # 根据转圈周期计算角速度
        self.position[0] = self.radius * math.cos(self.angle)
        self.position[1] = self.radius * math.sin(self.angle)
        self.position[2] = self.height  # 固定高度

        # 模拟姿态变化
        roll = math.sin(self.angle) * 0.1  # 横滚角微小晃动
        pitch = math.cos(self.angle) * 0.1  # 俯仰角微小晃动
        self.orientation = euler_to_quaternion(roll, pitch, self.angle)
        self.euler = quaternion_to_euler(self.orientation)

        self.send_status()

        # 模拟电池电压逐渐跌落
        if self.battery_voltage > self.final_voltage:
            self.battery_voltage -= (self.battery_voltage - self.final_voltage) / (
                self.flight_time / 10
            )  # 根据飞行时间线性减少电压

    def land(self):
        self.status = 3  # LANDING
        self.commander_mode = 2  # LANDING
        print(
            f"Flight Status: {all_flight_status[self.flight_status]}, Commander Mode: {ctrl_modes[self.commander_mode]}"
        )
        self.send_status()
        self.landing()

    def landing(self):
        start_time = time.time()
        while time.time() - start_time < self.landing_time:
            self.lps_time += 10  # 模拟时间戳增加
            self.position[2] = self.height - (time.time() - start_time) / self.landing_time * self.height  # 逐渐下降到地面
            self.send_status()
            time.sleep(0.1)  # 每0.1秒更新一次

        self.grounded()

    def grounded(self):
        self.status = 0  # GROUNDED
        self.flight_status = 0  # DISARMED
        print(
            f"Flight Status: {all_flight_status[self.flight_status]}, Commander Mode: {ctrl_modes[self.commander_mode]}"
        )
        self.send_status()
