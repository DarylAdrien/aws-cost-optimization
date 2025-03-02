import boto3
from datetime import datetime, timedelta, UTC

# AWS Clients
ec2 = boto3.client('ec2')
cloudwatch = boto3.client('cloudwatch')

# Get running EC2 instances
def get_running_instances():
    response = ec2.describe_instances(Filters=[{'Name': 'instance-state-name', 'Values': ['running']}])
    instances = []
    for reservation in response['Reservations']:
        for instance in reservation['Instances']:
            instances.append(instance['InstanceId'])
    return instances

# Check CPU usage for past 1 day
def get_cpu_utilization(instance_id):
    end_time = datetime.now(UTC)  # Fixed the warning
    start_time = end_time - timedelta(days=1)

    response = cloudwatch.get_metric_statistics(
        Namespace='AWS/EC2',
        MetricName='CPUUtilization',
        Dimensions=[{'Name': 'InstanceId', 'Value': instance_id}],
        StartTime=start_time,
        EndTime=end_time,
        Period=86400,  # Daily data
        Statistics=['Average']
    )

    if response['Datapoints']:
        avg_cpu = sum(dp['Average'] for dp in response['Datapoints']) / len(response['Datapoints'])
        return avg_cpu
    return None  # No data found

# Find underutilized instances
def find_underutilized_instances():
    underutilized = []
    for instance in get_running_instances():
        cpu_usage = get_cpu_utilization(instance)
        if cpu_usage is not None and cpu_usage < 10:  # Threshold: 10%
            underutilized.append(instance)
    return underutilized

# (Optional) Stop underutilized instances
def stop_instances(instances):
    if instances:
        ec2.stop_instances(InstanceIds=instances)
        print(f"Stopped instances: {instances}")
    else:
        print("No underutilized instances found.")

# Run the script
if __name__ == "__main__":
    instances = find_underutilized_instances()
    print(f"Underutilized instances: {instances}")

    stop_instances(instances)
