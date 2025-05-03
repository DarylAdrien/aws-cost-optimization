from flask import Flask, render_template, jsonify, request
import boto3
import json
from datetime import datetime, timedelta, UTC

app = Flask(__name__)

# Initialize AWS clients
ec2 = boto3.client('ec2')
cloudwatch = boto3.client('cloudwatch')
s3 = boto3.client('s3')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/elastic_ips', methods=['GET'])
def get_elastic_ips():
    ec2 = boto3.client('ec2')
    addresses = ec2.describe_addresses()['Addresses']
    
    unused_ips = []
    for address in addresses:
        if 'InstanceId' not in address:
            unused_ips.append({
                'PublicIp': address['PublicIp'],
                'AllocationId': address['AllocationId']
            })
    
    return jsonify(unused_ips)

@app.route('/api/delete_elastic_ip', methods=['POST'])
def delete_elastic_ip():
    data = request.get_json()
    allocation_id = data.get('allocation_id')
    
    if not allocation_id:
        return jsonify({'error': 'No allocation ID provided'}), 400
    
    try:
        ec2 = boto3.client('ec2')
        ec2.release_address(AllocationId=allocation_id)
        return jsonify({'success': True, 'message': f'Released Elastic IP with allocation ID: {allocation_id}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ebs_snapshots', methods=['GET'])
def get_ebs_snapshots():
    ec2 = boto3.client('ec2')
    
    # Get all EBS snapshots owned by the current AWS account
    response = ec2.describe_snapshots(OwnerIds=['self'])
    
    # Get all active EC2 instance IDs
    instances_response = ec2.describe_instances(Filters=[{'Name': 'instance-state-name', 'Values': ['running']}])
    active_instance_ids = {
        instance['InstanceId']
        for reservation in instances_response['Reservations']
        for instance in reservation['Instances']
    }
    
    snapshots = []
    for snapshot in response['Snapshots']:
        snapshot_info = {
            'SnapshotId': snapshot['SnapshotId'],
            'StartTime': snapshot['StartTime'].isoformat(),
            'VolumeSize': snapshot['VolumeSize'],
            'Status': 'Unused'
        }
        
        volume_id = snapshot.get('VolumeId')
        if volume_id:
            snapshot_info['VolumeId'] = volume_id
            try:
                volume_response = ec2.describe_volumes(VolumeIds=[volume_id])
                if volume_response['Volumes']:
                    volume = volume_response['Volumes'][0]
                    if volume['Attachments']:
                        snapshot_info['Status'] = 'In Use'
                    else:
                        snapshot_info['Status'] = 'Volume Detached'
            except ec2.exceptions.ClientError:
                snapshot_info['Status'] = 'Volume Deleted'
        else:
            snapshot_info['Status'] = 'No Volume'
        
        snapshots.append(snapshot_info)
    
    return jsonify(snapshots)

@app.route('/api/delete_snapshot', methods=['POST'])
def delete_snapshot():
    data = request.get_json()
    snapshot_id = data.get('snapshot_id')
    
    if not snapshot_id:
        return jsonify({'error': 'No snapshot ID provided'}), 400
    
    try:
        ec2 = boto3.client('ec2')
        ec2.delete_snapshot(SnapshotId=snapshot_id)
        return jsonify({'success': True, 'message': f'Deleted snapshot: {snapshot_id}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/s3_buckets', methods=['GET'])
def get_s3_buckets():
    s3 = boto3.client('s3')
    response = s3.list_buckets()
    
    buckets = []
    for bucket in response['Buckets']:
        bucket_name = bucket['Name']
        buckets.append({
            'Name': bucket_name,
            'CreationDate': bucket['CreationDate'].isoformat()
        })
    
    return jsonify(buckets)

@app.route('/api/s3_objects', methods=['GET'])
def get_s3_objects():
    bucket_name = request.args.get('bucket')
    if not bucket_name:
        return jsonify({'error': 'No bucket name provided'}), 400
    
    s3_objects = []
    try:
        s3 = boto3.client('s3')
        objects = s3.list_objects_v2(Bucket=bucket_name)
        
        if 'Contents' in objects:
            for obj in objects['Contents']:
                days_old = (datetime.now(UTC) - obj['LastModified']).days
                s3_objects.append({
                    'Key': obj['Key'],
                    'Size': obj['Size'],
                    'LastModified': obj['LastModified'].isoformat(),
                    'StorageClass': obj['StorageClass'],
                    'DaysOld': days_old,
                    'OlderThan30Days': days_old > 30
                })
                
        return jsonify(s3_objects)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/move_to_glacier', methods=['POST'])
def move_to_glacier():
    data = request.get_json()
    bucket_name = data.get('bucket')
    object_key = data.get('key')
    
    if not bucket_name or not object_key:
        return jsonify({'error': 'Bucket name and object key are required'}), 400
    
    try:
        s3 = boto3.client('s3')
        s3.copy_object(
            Bucket=bucket_name,
            CopySource={'Bucket': bucket_name, 'Key': object_key},
            Key=object_key,
            StorageClass='GLACIER'
        )
        return jsonify({'success': True, 'message': f'Moved {object_key} to Glacier storage'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/underutilized_instances', methods=['GET'])
def get_underutilized_instances():
    instances = []
    
    try:
        # Get running EC2 instances
        response = ec2.describe_instances(Filters=[{'Name': 'instance-state-name', 'Values': ['running']}])
        
        for reservation in response['Reservations']:
            for instance in reservation['Instances']:
                instance_id = instance['InstanceId']
                
                # Get CPU utilization for the past day
                end_time = datetime.now(UTC)
                start_time = end_time - timedelta(days=1)
                
                try:
                    cpu_response = cloudwatch.get_metric_statistics(
                        Namespace='AWS/EC2',
                        MetricName='CPUUtilization',
                        Dimensions=[{'Name': 'InstanceId', 'Value': instance_id}],
                        StartTime=start_time,
                        EndTime=end_time,
                        Period=86400,  # Daily data
                        Statistics=['Average']
                    )
                    
                    cpu_usage = None
                    if cpu_response['Datapoints']:
                        cpu_usage = sum(dp['Average'] for dp in cpu_response['Datapoints']) / len(cpu_response['Datapoints'])
                    
                    instance_info = {
                        'InstanceId': instance_id,
                        'InstanceType': instance.get('InstanceType', 'Unknown'),
                        'LaunchTime': instance.get('LaunchTime', '').isoformat() if instance.get('LaunchTime') else '',
                        'CPUUtilization': cpu_usage,
                        'Underutilized': cpu_usage is not None and cpu_usage < 10
                    }
                    
                    # Add tags if available
                    if 'Tags' in instance:
                        for tag in instance['Tags']:
                            if tag['Key'] == 'Name':
                                instance_info['Name'] = tag['Value']
                    
                    instances.append(instance_info)
                except Exception as e:
                    print(f"Error getting metrics for instance {instance_id}: {e}")
                    
        return jsonify(instances)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stop_instance', methods=['POST'])
def stop_instance():
    data = request.get_json()
    instance_id = data.get('instance_id')
    
    if not instance_id:
        return jsonify({'error': 'No instance ID provided'}), 400
    
    try:
        ec2.stop_instances(InstanceIds=[instance_id])
        return jsonify({'success': True, 'message': f'Stopped instance: {instance_id}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)