import boto3
import json
from datetime import datetime, timedelta , UTC

# AWS Clients
ec2 = boto3.client('ec2')
cloudwatch = boto3.client('cloudwatch')
sns = boto3.client('sns')

# SNS Topic ARN (Replace with your SNS topic ARN)
SNS_TOPIC_ARN = "arn:aws:sns:your-region:your-account-id:YourTopicName"

# Get running EC2 instances
def get_running_instances():
    response = ec2.describe_instances(Filters=[{'Name': 'instance-state-name', 'Values': ['running']}])
    instances = []
    for reservation in response['Reservations']:
        for instance in reservation['Instances']:
            instances.append(instance['InstanceId'])
    return instances

# Check CPU utilization for past 1 days
def get_cpu_utilization(instance_id):
    end_time = datetime.now(UTC)  
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
            underutilized.append((instance, cpu_usage))
    return underutilized

# Send SNS notification
def send_sns_notification(instances):
    if instances:
        message = "🚨 **Underutilized EC2 Instances Detected** 🚨\n\n"
        for instance_id, cpu in instances:
            message += f"Instance ID: {instance_id}, CPU Utilization: {cpu:.2f}%\n"

        sns.publish(TopicArn=SNS_TOPIC_ARN, Message=message, Subject="AWS Cost Optimization Alert")
        print("SNS Notification Sent!")
    else:
        print("No underutilized instances found.")

# AWS Lambda Handler
def lambda_handler(event, context):
    underutilized_instances = find_underutilized_instances()
    send_sns_notification(underutilized_instances)

    return {
        "statusCode": 200,
        "body": json.dumps({"message": "Lambda function executed successfully"})
    }
