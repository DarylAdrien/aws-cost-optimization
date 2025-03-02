import boto3

def lambda_handler(event, context):
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

    # Iterate through each snapshot
    for snapshot in response['Snapshots']:
        snapshot_id = snapshot['SnapshotId']
        volume_id = snapshot.get('VolumeId')  # Use .get() to avoid KeyError

        if not volume_id:
            # Delete the snapshot if it has no associated volume
            try:
                ec2.delete_snapshot(SnapshotId=snapshot_id)
                print(f"Deleted snapshot {snapshot_id}: No associated volume.")
            except Exception as e:
                print(f"Error deleting snapshot {snapshot_id}: {e}")
            continue  # Move to the next snapshot

        # Check if the volume exists
        try:
            volume_response = ec2.describe_volumes(VolumeIds=[volume_id])
            volume = volume_response['Volumes'][0]

            # If the volume is detached, delete the snapshot
            if not volume['Attachments']:
                try:
                    ec2.delete_snapshot(SnapshotId=snapshot_id)
                    print(f"Deleted snapshot {snapshot_id}: Volume {volume_id} is not attached to any running instance.")
                except Exception as e:
                    print(f"Error deleting snapshot {snapshot_id}: {e}")

        except ec2.exceptions.ClientError as e:
            if e.response['Error']['Code'] == 'InvalidVolume.NotFound':
                # The volume was deleted, so delete the snapshot
                try:
                    ec2.delete_snapshot(SnapshotId=snapshot_id)
                    print(f"Deleted snapshot {snapshot_id}: Associated volume {volume_id} not found.")
                except Exception as e:
                    print(f"Error deleting snapshot {snapshot_id}: {e}")
            else:
                print(f"Unexpected error checking volume {volume_id}: {e}")

