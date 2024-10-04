import { useState, useContext, useEffect, useCallback } from "react";
import { FaCog, FaUpload, FaTrash } from "react-icons/fa";
import { AuthContext } from "../context/AuthProvider";
import { useExpenses } from "../hooks/useExpenses.js";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import GlobalLoader from "../components/GlobalLoader";
import {
  Typography,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Input,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Paper,
  Divider,
  Pagination,
} from "@mui/material";
import { PieChart } from "react-minimal-pie-chart";

const BASE_URL = import.meta.env.VITE_BASE_URL;

export default function Profile() {
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedExpenses, setSelectedExpenses] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);

  const {
    isLoggedIn,
    user,
    logout,
    checkLoginStatus,
    loading: authLoading,
  } = useContext(AuthContext);
  const { expenses, fetchExpenses } = useExpenses();
  const navigate = useNavigate();

  const fetchUserData = useCallback(async () => {
    try {
      const response = await axios.get(`${BASE_URL}/users/getUser`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setName(response?.data?.data?.name);
      setEmail(response?.data?.data?.email);
      await fetchExpenses();
    } catch (error) {
      console.error("Error fetching user data:", error);
      toast.error("Failed to fetch user data");
    } finally {
      setIsLoading(false);
    }
  }, [BASE_URL, fetchExpenses]);

  useEffect(() => {
    const initializeProfile = async () => {
      if (!authLoading) {
        if (isLoggedIn) {
          await fetchUserData();
        } else {
          navigate("/signin");
        }
      }
    };

    initializeProfile();
  }, [isLoggedIn, navigate, fetchUserData, authLoading]);

  const totalExpenses = expenses.reduce((total, expense) => total + expense.amount, 0);
  const expenseCategories = expenses.reduce((acc, expense) => {
    if (!acc[expense.category]) {
      acc[expense.category] = { name: expense.category, total: 0 };
    }
    acc[expense.category].total += expense.amount;
    return acc;
  }, {});

  if (authLoading || isLoading) {
    return <GlobalLoader />;
  }

  if (!isLoggedIn || !user) {
    return null;
  }

  const handleDeleteAccount = () => {
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteAccount = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${BASE_URL}/users/delete/${user?._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("Account deleted successfully");
      setShowDeleteConfirmation(false);
      setShowSettings(false);

      await logout();
      navigate("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error(error.response?.data?.message || "Error deleting account. Please try again.");
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${BASE_URL}/users/update/${user?._id}`,
        { name, email },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Profile updated successfully");
      setShowSettings(false);
      checkLoginStatus();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(error.response?.data?.message || "Error updating profile. Please try again.");
    }
  };

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleBulkUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a CSV file to upload");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(`${BASE_URL}/expenses/bulk-upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("Response:", response.data);

      if (response.data.statusCode === 201) {
        toast.success(response.data.message);
        fetchExpenses();
      } else if (response.data.statusCode === 400) {
        const errorMessages = response.data.data.errors.join("\n");
        const validCount = response.data.data.validCount;

        toast.error(
          <div>
            <p>Validation errors in CSV:</p>
            <pre style={{ maxHeight: "200px", overflowY: "auto" }}>{errorMessages}</pre>
            <p>{`${validCount} valid expenses found.`}</p>
            <p>Please correct the errors and try again.</p>
          </div>,
          { autoClose: false }
        );
      }
    } catch (error) {
      console.error("Error uploading expenses:", error);
      console.error("Error response:", error.response?.data);
      if (error.response?.data?.statusCode === 400) {
        const errorMessages = error.response.data.data.errors.join("\n");
        const validCount = error.response.data.data.validCount;

        toast.error(
          <div>
            <p>Validation errors in CSV:</p>
            <pre style={{ maxHeight: "200px", overflowY: "auto" }}>{errorMessages}</pre>
            <p>{`${validCount} valid expenses found.`}</p>
            <p>Please correct the errors and try again.</p>
          </div>,
          { autoClose: false }
        );
      } else {
        toast.error(error.response?.data?.message || "Error uploading expenses. Please try again.");
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedExpenses.length === 0) {
      toast.error("Please select expenses to delete");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${BASE_URL}/expenses/bulk-delete`,
        { ids: selectedExpenses },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("Selected expenses deleted successfully");
      setSelectedExpenses([]);
      fetchExpenses();
    } catch (error) {
      console.error("Error deleting expenses:", error);
      toast.error(error.response?.data?.message || "Error deleting expenses. Please try again.");
    }
  };

  const handleSelectExpense = (id) => {
    if (selectedExpenses.includes(id)) {
      setSelectedExpenses(selectedExpenses.filter((expenseId) => expenseId !== id));
    } else {
      setSelectedExpenses([...selectedExpenses, id]);
    }
  };

  return (
    <div style={{ padding: "20px", backgroundColor: "#f5f5f5" }}>
      <Paper elevation={3} style={{ padding: "20px", marginBottom: "20px", backgroundColor: "#ffffff" }}>
        <Typography variant="h4" component="h1" color="text.primary">
          Profile
        </Typography>
        <Divider />
        <Typography variant="h6" color="text.secondary">
          Name: {name}
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Email: {email}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setShowSettings(true)}
          startIcon={<FaCog />}
          style={{ marginTop: "10px" }}
        >
          Edit Profile
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          onClick={handleDeleteAccount}
          startIcon={<FaTrash />}
          style={{ marginTop: "10px", marginLeft: "10px" }}
        >
          Delete Account
        </Button>
      </Paper>

      <Paper elevation={3} style={{ padding: "20px", backgroundColor: "#ffffff" }}>
        <Typography variant="h5" component="h2" color="text.primary">
          Expenses Overview
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Total Expenses: ${totalExpenses.toFixed(2)}
        </Typography>
        <PieChart
          data={Object.values(expenseCategories).map((category) => ({
            title: category.name,
            value: category.total,
            color: '#' + Math.floor(Math.random() * 16777215).toString(16),
          }))}
          style={{ height: '300px', margin: '20px 0' }}
        />
      </Paper>

      <Paper elevation={3} style={{ padding: "20px", backgroundColor: "#ffffff" }}>
        <Typography variant="h5" component="h2" color="text.primary">
          Manage Expenses
        </Typography>
        <Input type="file" accept=".csv" onChange={handleFileChange} />
        <Button
          variant="contained"
          color="primary"
          onClick={handleBulkUpload}
          startIcon={<FaUpload />}
          style={{ marginTop: "10px" }}
        >
          Upload Expenses
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={handleBulkDelete}
          startIcon={<FaTrash />}
          style={{ marginTop: "10px", marginLeft: "10px" }}
        >
          Delete Selected
        </Button>
        <Divider style={{ margin: "20px 0" }} />
        <List>
          {expenses.map((expense) => (
            <ListItem key={expense._id} dense button onClick={() => handleSelectExpense(expense._id)}>
              <Checkbox
                edge="start"
                checked={selectedExpenses.includes(expense._id)}
                tabIndex={-1}
                disableRipple
              />
              <ListItemText primary={`${expense.category}: $${expense.amount}`} />
            </ListItem>
          ))}
        </List>
        <Pagination
          count={Math.ceil(expenses.length / itemsPerPage)}
          page={currentPage}
          onChange={(event, value) => setCurrentPage(value)}
        />
      </Paper>

      <Dialog open={showSettings} onClose={() => setShowSettings(false)}>
        <DialogTitle>Edit Profile</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Please update your profile information below.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            type="text"
            fullWidth
            variant="outlined"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Email"
            type="email"
            fullWidth
            variant="outlined"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleUpdateProfile} color="primary">
            Update
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showDeleteConfirmation} onClose={() => setShowDeleteConfirmation(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete your account? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteConfirmation(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={confirmDeleteAccount} color="secondary">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
