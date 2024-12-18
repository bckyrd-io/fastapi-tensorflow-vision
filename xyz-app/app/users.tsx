import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, FlatList, Alert, Modal, TextInput, Button } from 'react-native';
import { Feather } from '@expo/vector-icons'; // Icon library for mobile
import { useNavigation } from '@react-navigation/native'; // For navigation

// Define the custom green color
const primaryGreen = '#10b981';

const UsersScreen = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>('admin'); // Assuming role is admin
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newRole, setNewRole] = useState('');
  const [loading, setLoading] = useState(false);

  const userId = '12345'; // Example user ID, replace with actual logic

  const navigation = useNavigation();

  // Fetch user data
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`http://localhost:8000/users/${userId}`);
      if (response.status === 200) {
        const data = await response.json();
        setUsers(data.users);
      } else {
        alert('Failed to fetch users.');
      }
    } catch (error) {
      alert('Error fetching users.');
    }
  };

  const editUserRole = async (userId: string, username: string) => {
    setModalVisible(true);
    setSelectedUser({ userId, username });
  };

  const saveRoleChange = async () => {
    if (newRole !== 'admin' && newRole !== 'researcher') {
      alert('Invalid role. Please enter "admin" or "researcher".');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`http://localhost:8000/user/${selectedUser.userId}/edit-role?new_role=${newRole}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 200) {
        alert('User role updated successfully.');
        fetchUsers();
      } else {
        alert('Failed to update user role.');
      }
    } catch (error) {
      alert('Error updating user role.');
    } finally {
      setLoading(false);
      setModalVisible(false);
      setNewRole('');
    }
  };

  const deleteUser = async (userId: string, username: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete ${username}?`);
    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/user/${userId}/delete`, {
        method: 'DELETE',
      });

      if (response.status === 200) {
        alert(`${username} deleted successfully.`);
        fetchUsers();
      } else {
        alert('Failed to delete user.');
      }
    } catch (error) {
      alert('Error deleting user.');
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.tableRow}>
      <View style={styles.userCell}>
        <Image source={{ uri: './img/avatar/avatar-illustrated-02.png' }} style={styles.userImage} />
        <Text style={styles.usernameText}>{item.username}</Text>
      </View>
      <Text style={styles.roleBadge}>{item.role}</Text>
      {userRole === 'admin' ? (
        <View style={styles.actionButtons}>
          <TouchableOpacity onPress={() => editUserRole(item.id, item.username)} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteUser(item.id, item.username)} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.noAction}>None</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Access Control</Text>

      {/* Table List */}
      <FlatList
        data={users}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.table}
      />

      {/* Edit Role Modal */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Role</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter new role (admin/researcher)"
              value={newRole}
              onChangeText={setNewRole}
            />
            <View style={styles.modalActions}>
              <Button title="Cancel" onPress={() => setModalVisible(false)} />
              <Button title="Save" onPress={saveRoleChange} disabled={loading} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  table: {
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  userCell: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
  },
  userImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  usernameText: {
    fontSize: 16,
  },
  roleBadge: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    color: '#777',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 2,
  },
  actionButton: {
    backgroundColor: primaryGreen,
    padding: 5,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  noAction: {
    color: '#aaa',
    fontStyle: 'italic',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    width: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export default UsersScreen;
