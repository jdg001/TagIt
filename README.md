# TagIt
Label design software with support for barcodes.

## 📂 Project Structure

- **TagItUI/**  
  Angular based frontend for the TagIT project
    
- **TagItBackend/**  
  ASP.NET Core Web API project containing APIs for:
  - Adding new label templates to the database  
  - Fetching templates by ID  
  - Listing all templates  

- **TagItDB/**  
  SQL scripts required to create the database and tables.  

---

## ⚙️ Setup Instructions

### 1. Database Setup
1. Open SQL Server Management Studio (SSMS).  
2. Execute the script from the **TagItDB** folder to create the database and tables
