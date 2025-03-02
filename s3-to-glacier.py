import boto3
from datetime import datetime

def move_s3_to_glacier(bucket_name):
    s3 = boto3.client('s3')

    # Get all objects in the bucket
    objects = s3.list_objects_v2(Bucket=bucket_name)

    if 'Contents' in objects:
        for obj in objects['Contents']:
            key = obj['Key']
            last_modified = obj['LastModified']

            # Move files older than 30 days
            if (datetime.now(last_modified.tzinfo) - last_modified).days > 30:
                s3.copy_object(
                    Bucket=bucket_name,
                    CopySource={'Bucket': bucket_name, 'Key': key},
                    Key=key,
                    StorageClass='GLACIER'
                )
                print(f"Moved {key} to Glacier storage.")

# Example usage
move_s3_to_glacier("your-bucket-name")
