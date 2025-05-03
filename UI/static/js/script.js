document.addEventListener('DOMContentLoaded', function() {
    // Initialize the app
    initializeApp();
    
    // Set up service filter
    document.getElementById('service-filter').addEventListener('change', filterServices);
});

function initializeApp() {
    // Load all data
    loadAllData();
    
    // Set up modal events
    document.getElementById('cancel-btn').addEventListener('click', closeModal);
}

function loadAllData() {
    loadElasticIPs();
    loadEBSSnapshots();
    loadS3Buckets();
    loadEC2Instances();
}

// Filter services based on selection
function filterServices() {
    const selectedService = document.getElementById('service-filter').value;
    const serviceCards = document.querySelectorAll('.service-card');
    
    if (selectedService === 'all') {
        // Show all cards
        serviceCards.forEach(card => {
            card.classList.remove('hidden');
        });
        document.getElementById('overview-card').style.display = 'block';
    } else {
        // Show only selected service and hide overview
        serviceCards.forEach(card => {
            if (card.getAttribute('data-service') === selectedService) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });
        document.getElementById('overview-card').style.display = 'none';
    }
}

// EC2 Instances
function loadEC2Instances() {
    document.getElementById('ec2-loading').style.display = 'block';
    document.getElementById('ec2-table').style.display = 'none';
    document.getElementById('ec2-empty').style.display = 'none';
    
    fetch('/api/underutilized_instances')
        .then(response => response.json())
        .then(data => {
            const tableBody = document.querySelector('#ec2-table tbody');
            tableBody.innerHTML = '';
            
            // Update dashboard counter
            const underutilizedCount = data.filter(instance => instance.Underutilized).length;
            document.getElementById('ec2-count').textContent = underutilizedCount;
            
            if (data.length === 0 || underutilizedCount === 0) {
                document.getElementById('ec2-empty').style.display = 'block';
                document.getElementById('ec2-table').style.display = 'none';
            } else {
                data.forEach(instance => {
                    if (instance.Underutilized) {
                        const row = document.createElement('tr');
                        
                        row.innerHTML = `
                            <td>${instance.InstanceId}</td>
                            <td>${instance.Name || 'N/A'}</td>
                            <td>${instance.InstanceType}</td>
                            <td>${instance.CPUUtilization ? instance.CPUUtilization.toFixed(2) + '%' : 'N/A'}</td>
                            <td>
                                <button class="btn btn-danger" onclick="confirmStopInstance('${instance.InstanceId}')">
                                    <i class="fas fa-stop-circle"></i> Stop
                                </button>
                            </td>
                        `;
                        
                        tableBody.appendChild(row);
                    }
                });
                
                document.getElementById('ec2-table').style.display = 'table';
                document.getElementById('ec2-empty').style.display = 'none';
            }
            
            document.getElementById('ec2-loading').style.display = 'none';
        })
        .catch(error => {
            console.error('Error loading EC2 instances:', error);
            document.getElementById('ec2-loading').style.display = 'none';
            document.getElementById('ec2-empty').style.display = 'block';
            document.getElementById('ec2-empty').textContent = 'Error loading EC2 instances.';
        });
}

function confirmStopInstance(instanceId) {
    showConfirmationModal(
        `Are you sure you want to stop instance ${instanceId}?`,
        () => stopInstance(instanceId)
    );
}

function stopInstance(instanceId) {
    fetch('/api/stop_instance', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ instance_id: instanceId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadEC2Instances(); // Reload the list
            showToast('Instance stopped successfully');
        } else {
            showToast('Failed to stop instance: ' + data.error, 'error');
        }
    })
    .catch(error => {
        console.error('Error stopping instance:', error);
        showToast('Failed to stop instance', 'error');
    });
}

// Elastic IPs
function loadElasticIPs() {
    document.getElementById('eip-loading').style.display = 'block';
    document.getElementById('eip-table').style.display = 'none';
    document.getElementById('eip-empty').style.display = 'none';
    
    fetch('/api/elastic_ips')
        .then(response => response.json())
        .then(data => {
            const tableBody = document.querySelector('#eip-table tbody');
            tableBody.innerHTML = '';
            
            // Update dashboard counter
            document.getElementById('eip-count').textContent = data.length;
            
            if (data.length === 0) {
                document.getElementById('eip-empty').style.display = 'block';
                document.getElementById('eip-table').style.display = 'none';
            } else {
                data.forEach(ip => {
                    const row = document.createElement('tr');
                    
                    row.innerHTML = `
                        <td>${ip.PublicIp}</td>
                        <td>${ip.AllocationId}</td>
                        <td>
                            <button class="btn btn-danger" onclick="confirmDeleteElasticIP('${ip.AllocationId}', '${ip.PublicIp}')">
                                <i class="fas fa-trash"></i> Release
                            </button>
                        </td>
                    `;
                    
                    tableBody.appendChild(row);
                });
                
                document.getElementById('eip-table').style.display = 'table';
                document.getElementById('eip-empty').style.display = 'none';
            }
            
            document.getElementById('eip-loading').style.display = 'none';
        })
        .catch(error => {
            console.error('Error loading Elastic IPs:', error);
            document.getElementById('eip-loading').style.display = 'none';
            document.getElementById('eip-empty').style.display = 'block';
            document.getElementById('eip-empty').textContent = 'Error loading Elastic IPs.';
        });
}

function confirmDeleteElasticIP(allocationId, publicIp) {
    showConfirmationModal(
        `Are you sure you want to release Elastic IP ${publicIp}?`,
        () => deleteElasticIP(allocationId)
    );
}

function deleteElasticIP(allocationId) {
    fetch('/api/delete_elastic_ip', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ allocation_id: allocationId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadElasticIPs(); // Reload the list
            showToast('Elastic IP released successfully');
        } else {
            showToast('Failed to release Elastic IP: ' + data.error, 'error');
        }
    })
    .catch(error => {
        console.error('Error releasing Elastic IP:', error);
        showToast('Failed to release Elastic IP', 'error');
    });
}

// EBS Snapshots
function loadEBSSnapshots() {
    document.getElementById('ebs-loading').style.display = 'block';
    document.getElementById('ebs-table').style.display = 'none';
    document.getElementById('ebs-empty').style.display = 'none';
    
    fetch('/api/ebs_snapshots')
        .then(response => response.json())
        .then(data => {
            const tableBody = document.querySelector('#ebs-table tbody');
            tableBody.innerHTML = '';
            
            // Filter unused snapshots
            const unusedSnapshots = data.filter(snapshot => 
                snapshot.Status === 'Unused' || 
                snapshot.Status === 'Volume Detached' || 
                snapshot.Status === 'Volume Deleted' ||
                snapshot.Status === 'No Volume'
            );
            
            // Update dashboard counter
            document.getElementById('snapshot-count').textContent = unusedSnapshots.length;
            
            if (unusedSnapshots.length === 0) {
                document.getElementById('ebs-empty').style.display = 'block';
                document.getElementById('ebs-table').style.display = 'none';
            } else {
                unusedSnapshots.forEach(snapshot => {
                    const row = document.createElement('tr');
                    
                    row.innerHTML = `
                        <td>${snapshot.SnapshotId}</td>
                        <td>${snapshot.VolumeId || 'N/A'}</td>
                        <td>${snapshot.VolumeSize}</td>
                        <td>${snapshot.Status}</td>
                        <td>
                            <button class="btn btn-danger" onclick="confirmDeleteSnapshot('${snapshot.SnapshotId}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </td>
                    `;
                    
                    tableBody.appendChild(row);
                });
                
                document.getElementById('ebs-table').style.display = 'table';
                document.getElementById('ebs-empty').style.display = 'none';
            }
            
            document.getElementById('ebs-loading').style.display = 'none';
        })
        .catch(error => {
            console.error('Error loading EBS snapshots:', error);
            document.getElementById('ebs-loading').style.display = 'none';
            document.getElementById('ebs-empty').style.display = 'block';
            document.getElementById('ebs-empty').textContent = 'Error loading EBS snapshots.';
        });
}

function confirmDeleteSnapshot(snapshotId) {
    showConfirmationModal(
        `Are you sure you want to delete snapshot ${snapshotId}?`,
        () => deleteSnapshot(snapshotId)
    );
}

function deleteSnapshot(snapshotId) {
    fetch('/api/delete_snapshot', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ snapshot_id: snapshotId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadEBSSnapshots(); // Reload the list
            showToast('Snapshot deleted successfully');
        } else {
            showToast('Failed to delete snapshot: ' + data.error, 'error');
        }
    })
    .catch(error => {
        console.error('Error deleting snapshot:', error);
        showToast('Failed to delete snapshot', 'error');
    });
}

// S3 Storage
function loadS3Buckets() {
    document.getElementById('s3-loading').style.display = 'block';
    document.getElementById('s3-bucket-list').innerHTML = '';
    document.getElementById('s3-table').style.display = 'none';
    document.getElementById('s3-empty').style.display = 'block';
    document.getElementById('s3-empty').textContent = 'Select a bucket to view objects.';
    
    fetch('/api/s3_buckets')
        .then(response => response.json())
        .then(data => {
            const bucketList = document.getElementById('s3-bucket-list');
            bucketList.innerHTML = '';
            
            if (data.length === 0) {
                const li = document.createElement('li');
                li.textContent = 'No buckets found';
                bucketList.appendChild(li);
            } else {
                data.forEach(bucket => {
                    const li = document.createElement('li');
                    li.textContent = bucket.Name;
                    li.onclick = () => loadS3Objects(bucket.Name);
                    bucketList.appendChild(li);
                });
            }
            
            document.getElementById('s3-loading').style.display = 'none';
        })
        .catch(error => {
            console.error('Error loading S3 buckets:', error);
            document.getElementById('s3-loading').style.display = 'none';
            const bucketList = document.getElementById('s3-bucket-list');
            bucketList.innerHTML = '<li>Error loading buckets</li>';
        });
}

function loadS3Objects(bucketName) {
    // Highlight selected bucket
    const bucketItems = document.querySelectorAll('#s3-bucket-list li');
    bucketItems.forEach(item => {
        if (item.textContent === bucketName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    document.getElementById('selected-bucket').textContent = `(${bucketName})`;
    document.getElementById('s3-loading').style.display = 'block';
    document.getElementById('s3-table').style.display = 'none';
    document.getElementById('s3-empty').style.display = 'none';
    
    fetch(`/api/s3_objects?bucket=${encodeURIComponent(bucketName)}`)
        .then(response => response.json())
        .then(data => {
            const tableBody = document.querySelector('#s3-table tbody');
            tableBody.innerHTML = '';
            
            // Filter objects older than 30 days
            const oldObjects = data.filter(obj => obj.OlderThan30Days);
            
            // Update dashboard counter (sum of all old objects across all buckets)
            // This is simplified and will only show for the current bucket
            document.getElementById('s3-count').textContent = oldObjects.length;
            
            if (data.length === 0) {
                document.getElementById('s3-empty').style.display = 'block';
                document.getElementById('s3-empty').textContent = 'No objects found in this bucket.';
                document.getElementById('s3-table').style.display = 'none';
            } else {
                data.forEach(obj => {
                    const row = document.createElement('tr');
                    
                    // Format size
                    const sizeInKB = obj.Size / 1024;
                    const sizeInMB = sizeInKB / 1024;
                    let sizeFormatted;
                    
                    if (sizeInMB >= 1) {
                        sizeFormatted = `${sizeInMB.toFixed(2)} MB`;
                    } else {
                        sizeFormatted = `${sizeInKB.toFixed(2)} KB`;
                    }
                    
                    row.innerHTML = `
                        <td>${obj.Key}</td>
                        <td>${sizeFormatted}</td>
                        <td>${obj.DaysOld}</td>
                        <td>${obj.StorageClass}</td>
                        <td>
                            ${obj.OlderThan30Days && obj.StorageClass !== 'GLACIER' ? 
                                `<button class="btn btn-warning" onclick="confirmMoveToGlacier('${bucketName}', '${obj.Key}')">
                                    <i class="fas fa-archive"></i> Move to Glacier
                                </button>` : 
                                ''}
                        </td>
                    `;
                    
                    tableBody.appendChild(row);
                });
                
                document.getElementById('s3-table').style.display = 'table';
                document.getElementById('s3-empty').style.display = 'none';
            }
            
            document.getElementById('s3-loading').style.display = 'none';
        })
        .catch(error => {
            console.error('Error loading S3 objects:', error);
            document.getElementById('s3-loading').style.display = 'none';
            document.getElementById('s3-empty').style.display = 'block';
            document.getElementById('s3-empty').textContent = 'Error loading objects.';
        });
}

function confirmMoveToGlacier(bucketName, objectKey) {
    showConfirmationModal(
        `Are you sure you want to move "${objectKey}" to Glacier storage?`,
        () => moveToGlacier(bucketName, objectKey)
    );
}

function moveToGlacier(bucketName, objectKey) {
    fetch('/api/move_to_glacier', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bucket: bucketName, key: objectKey })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadS3Objects(bucketName); // Reload the list
            showToast('Object moved to Glacier successfully');
        } else {
            showToast('Failed to move object: ' + data.error, 'error');
        }
    })
    .catch(error => {
        console.error('Error moving object to Glacier:', error);
        showToast('Failed to move object to Glacier', 'error');
    });
}

// Modal Functions
function showConfirmationModal(message, confirmCallback) {
    const modal = document.getElementById('confirmation-modal');
    const modalMessage = document.getElementById('modal-message');
    const confirmBtn = document.getElementById('confirm-btn');
    
    modalMessage.textContent = message;
    
    // Set up confirm button action
    confirmBtn.onclick = () => {
        confirmCallback();
        closeModal();
    };
    
    // Show modal
    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('confirmation-modal');
    modal.style.display = 'none';
}

// Toast notification (simple implementation)
function showToast(message, type = 'success') {
    // Create toast element if it doesn't exist
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.padding = '10px 20px';
        toast.style.borderRadius = '4px';
        toast.style.color = 'white';
        toast.style.zIndex = '1000';
        toast.style.transition = 'opacity 0.5s ease';
        document.body.appendChild(toast);
    }
    
    // Set toast style based on type
    if (type === 'error') {
        toast.style.backgroundColor = 'var(--danger-color)';
    } else {
        toast.style.backgroundColor = 'var(--success-color)';
    }
    
    // Set message and show toast
    toast.textContent = message;
    toast.style.opacity = '1';
    
    // Hide toast after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 3000);
}