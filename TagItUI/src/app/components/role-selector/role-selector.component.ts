import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-role-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="role-selector-container">
      <div class="role-selector-card">
        <div class="header">
          <h1>TagIt</h1>
          <p>Select your role(s) to continue</p>
        </div>

        <div class="role-selection">
          <div class="role-options">
            <label class="role-option" *ngFor="let role of availableRoles">
              <input 
                type="checkbox" 
                [value]="role.value" 
                [checked]="selectedRoles.includes(role.value)"
                (change)="toggleRole(role.value)">
              <div class="role-info">
                <span class="role-name">{{ role.name }}</span>
                <span class="role-description">{{ role.description }}</span>
              </div>
            </label>
          </div>

          <div class="selected-roles" *ngIf="selectedRoles.length > 0">
            <p class="selected-count">{{ selectedRoles.length }} role(s) selected</p>
          </div>
        </div>

        <div class="actions">
          <button 
            class="btn btn-primary" 
            (click)="continueToDashboard()" 
            [disabled]="selectedRoles.length === 0">
            Continue to Dashboard
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .role-selector-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
    }

    .role-selector-card {
      background: white;
      border-radius: 1rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      padding: 2rem;
      max-width: 400px;
      width: 100%;
    }

    .header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .header h1 {
      color: #1f2937;
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .header p {
      color: #6b7280;
      font-size: 1rem;
    }

    .role-selection {
      margin-bottom: 2rem;
    }

    .role-options {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .role-option {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem;
      background: #f9fafb;
      border-radius: 0.5rem;
      border: 2px solid transparent;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .role-option:hover {
      background: #f3f4f6;
      border-color: #e5e7eb;
    }

    .role-option input[type="checkbox"] {
      width: 1.125rem;
      height: 1.125rem;
      accent-color: #3b82f6;
      margin-top: 0.125rem;
      flex-shrink: 0;
    }

    .role-info {
      flex: 1;
    }

    .role-name {
      display: block;
      font-weight: 600;
      color: #1f2937;
      font-size: 1rem;
      margin-bottom: 0.25rem;
    }

    .role-description {
      display: block;
      color: #6b7280;
      font-size: 0.8rem;
      line-height: 1.4;
    }

    .selected-roles {
      margin-top: 1rem;
      padding: 0.75rem;
      background: #f0f9ff;
      border-radius: 0.5rem;
      border: 1px solid #bae6fd;
      text-align: center;
    }

    .selected-count {
      color: #1e40af;
      font-size: 0.875rem;
      font-weight: 500;
      margin: 0;
    }

    .actions {
      margin-bottom: 0;
    }

    .btn {
      padding: 0.875rem 2rem;
      border-radius: 0.5rem;
      border: none;
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.2s ease;
      width: 100%;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #2563eb;
      transform: translateY(-1px);
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }

    .btn-primary:disabled {
      background: #9ca3af;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    @media (max-width: 640px) {
      .role-selector-container {
        padding: 1rem;
      }
      
      .role-selector-card {
        padding: 1.5rem;
      }
      
      .header h1 {
        font-size: 1.75rem;
      }
    }
  `]
})
export class RoleSelectorComponent {
  availableRoles = [
    {
      value: 'Admin',
      name: 'Administrator',
      description: 'Full system access including user management, template creation, review, and publishing.'
    },
    {
      value: 'Designer',
      name: 'Designer',
      description: 'Create, edit, and manage templates. Submit templates for review.'
    },
    {
      value: 'Reviewer',
      name: 'Reviewer',
      description: 'Review, approve, reject, and publish templates submitted by designers.'
    }
  ];

  selectedRoles: string[] = [];

  constructor(private router: Router) {}

  toggleRole(roleValue: string) {
    if (this.selectedRoles.includes(roleValue)) {
      this.selectedRoles = this.selectedRoles.filter(role => role !== roleValue);
    } else {
      this.selectedRoles.push(roleValue);
    }
  }

  continueToDashboard() {
    if (this.selectedRoles.length === 0) return;
    
    // [CHANGE] Use actual database User IDs instead of hardcoded ones
    // These match the database users: sana.assain@gmail.com (Admin=1), sana01assain@gmail.com (Designer=2), sana.assain01@gmail.com (Reviewer=3)
    let userId: number;
    
    if (this.selectedRoles.includes('Admin')) {
      userId = 1; // sana.assain@gmail.com (Admin) - Database User ID 1
    } else if (this.selectedRoles.includes('Designer')) {
      userId = 2; // sana01assain@gmail.com (Designer) - Database User ID 2
    } else if (this.selectedRoles.includes('Reviewer')) {
      userId = 3; // sana.assain01@gmail.com (Reviewer) - Database User ID 3
    } else {
      userId = 2; // Default to Designer
    }
    
    // Save selected roles and user ID to localStorage
    localStorage.setItem('userRoles', JSON.stringify(this.selectedRoles));
    localStorage.setItem('userId', userId.toString());
    
    // [CHANGE] Set flag to indicate we're using role selector mode
    localStorage.setItem('useRoleSelector', 'true');
    
    console.log(`[ROLE SELECTOR] Selected roles: ${this.selectedRoles.join(', ')}, Assigned Database User ID: ${userId}`);
    
    // Navigate to dashboard
    this.router.navigate(['/dashboard']);
  }
}
