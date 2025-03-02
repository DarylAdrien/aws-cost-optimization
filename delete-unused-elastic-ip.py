import boto3

def delete_unused_elastic_ips():
    ec2 = boto3.client('ec2')

    # Get all Elastic IPs
    addresses = ec2.describe_addresses()['Addresses']

    for address in addresses:
        if 'InstanceId' not in address:
            public_ip = address['PublicIp']
            allocation_id = address['AllocationId']

            # Release the unused Elastic IP
            ec2.release_address(AllocationId=allocation_id)
            print(f"Released unused Elastic IP: {public_ip}")

# Call this function inside lambda_handler
delete_unused_elastic_ips()
