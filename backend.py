# ==========================================
# CELL 1: INITIALIZATION & FEATURE ENGINEERING
# ==========================================
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import HistGradientBoostingRegressor, ExtraTreesRegressor, GradientBoostingRegressor, VotingRegressor
from sklearn.metrics import mean_squared_error, r2_score

print("Initializing data pipeline...")
file_path = "Concrete_Data.csv" 
df = pd.read_csv(file_path)

df.columns = ['Cement', 'Blast_Furnace_Slag', 'Fly_Ash', 'Water', 
              'Superplasticizer', 'Coarse_Aggregate', 'Fine_Aggregate', 
              'Age', 'Compressive_Strength']

# Domain-specific feature engineering for mix proportioning
df['Binder'] = df['Cement'] + df['Blast_Furnace_Slag'] + df['Fly_Ash']
df['Water_Binder_Ratio'] = df['Water'] / df['Binder']
df['Total_Aggregate'] = df['Coarse_Aggregate'] + df['Fine_Aggregate']
df['Aggregate_Binder_Ratio'] = df['Total_Aggregate'] / df['Binder']

feature_cols = ['Cement', 'Blast_Furnace_Slag', 'Fly_Ash', 'Water', 
                'Superplasticizer', 'Coarse_Aggregate', 'Fine_Aggregate', 
                'Age', 'Binder', 'Water_Binder_Ratio', 'Total_Aggregate', 
                'Aggregate_Binder_Ratio']

X = df[feature_cols]
y = df['Compressive_Strength']

# ==========================================
# CELL 2: DATA PREPARATION & SCALING
# ==========================================
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# ==========================================
# CELL 3: ENSEMBLE REGRESSION MODEL TRAINING
# ==========================================
print("Training ensemble regression algorithms...")
hgb = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=7, random_state=42)
et = ExtraTreesRegressor(n_estimators=300, max_depth=15, min_samples_split=2, random_state=42)
gb = GradientBoostingRegressor(n_estimators=300, learning_rate=0.05, max_depth=5, subsample=0.8, random_state=42)

ensemble_model = VotingRegressor(estimators=[
    ('HistGB', hgb), 
    ('ExtraTrees', et), 
    ('GradientBoost', gb)
])

ensemble_model.fit(X_train_scaled, y_train)

# ==========================================
# CELL 4: MODEL EVALUATION
# ==========================================
predictions = ensemble_model.predict(X_test_scaled)
r2 = r2_score(y_test, predictions)
rmse = np.sqrt(mean_squared_error(y_test, predictions))

print(f"Model Accuracy (R2): {r2:.4f}")
print(f"Error Margin (RMSE): {rmse:.2f} MPa")

# ==========================================
# CELL 5: CLIMATE, HUMIDITY & OPERATIONAL COST ENGINE
# ==========================================
MATERIAL_COSTS = {
    'Cement': 0.12, 'Blast_Furnace_Slag': 0.05, 'Fly_Ash': 0.04, 
    'Water': 0.001, 'Superplasticizer': 2.50, 'Coarse_Aggregate': 0.02, 
    'Fine_Aggregate': 0.02
}

AUTOMATION_PROFILES = {
    'Manual': {'handling_days': 1.0, 'labor_cost_per_day': 40.0, 'equip_cost_per_day': 10.0},
    'Semi-Auto': {'handling_days': 0.5, 'labor_cost_per_day': 25.0, 'equip_cost_per_day': 30.0},
    'Fully-Auto': {'handling_days': 0.2, 'labor_cost_per_day': 10.0, 'equip_cost_per_day': 60.0}
}

STEAM_ENERGY_PER_DAY = 20.00   

def calculate_material_cost(mix_design):
    return sum(mix_design.get(mat, 0) * price for mat, price in MATERIAL_COSTS.items())

def simulate_curing_cycle(model, scaler, base_mix, target_strength, temp_c, humidity_percent, automation_tier, is_steam=False):
    STANDARD_TEMP = 20.0 
    DATUM_TEMP = -10.0
    OPTIMAL_RH = 85.0
    
    # Calculate temperature modifier
    temp_modifier = (temp_c - DATUM_TEMP) / (STANDARD_TEMP - DATUM_TEMP)
    
    # Calculate humidity penalty (if below optimal threshold)
    humidity_modifier = humidity_percent / OPTIMAL_RH if humidity_percent < OPTIMAL_RH else 1.0
    
    auto_profile = AUTOMATION_PROFILES[automation_tier]
    
    for real_day in range(1, 29): # Max 28 days
        mix_sim = base_mix.copy()
        
        # Apply combined maturity modifiers
        equivalent_age = real_day * temp_modifier * humidity_modifier
        mix_sim['Age'] = equivalent_age 
        
        binder = mix_sim['Cement'] + mix_sim['Blast_Furnace_Slag'] + mix_sim['Fly_Ash']
        mix_sim['Binder'] = binder
        mix_sim['Water_Binder_Ratio'] = mix_sim['Water'] / binder
        total_agg = mix_sim['Coarse_Aggregate'] + mix_sim['Fine_Aggregate']
        mix_sim['Total_Aggregate'] = total_agg
        mix_sim['Aggregate_Binder_Ratio'] = total_agg / binder
        
        ordered_mix = {col: mix_sim[col] for col in feature_cols}
        mix_scaled = scaler.transform(pd.DataFrame([ordered_mix]))
        predicted_strength = model.predict(mix_scaled)[0]
        
        if predicted_strength >= target_strength:
            mat_cost = calculate_material_cost(base_mix)
            total_cycle_days = real_day + auto_profile['handling_days']
            
            labor_cost = total_cycle_days * auto_profile['labor_cost_per_day']
            equip_cost = total_cycle_days * auto_profile['equip_cost_per_day']
            energy_cost = (real_day * STEAM_ENERGY_PER_DAY) if is_steam else 0.0
            
            total_cost = mat_cost + labor_cost + equip_cost + energy_cost
            
            costs = {'Material': mat_cost, 'Labor': labor_cost, 'Equipment': equip_cost, 'Energy': energy_cost, 'Total': total_cost}
            return real_day, total_cycle_days, predicted_strength, costs
            
    return None, None, None, None

# ==========================================
# CELL 6: MULTI-VARIABLE MATRIX EXECUTION
# ==========================================
print("\nExecuting Operational Matrix Simulation...")

sample_mix = {
    'Cement': 350.0, 'Blast_Furnace_Slag': 0.0, 'Fly_Ash': 100.0,
    'Water': 160.0, 'Superplasticizer': 5.0, 'Coarse_Aggregate': 1000.0,
    'Fine_Aggregate': 750.0
}
target_str = 30.0 

climates = {
    'Winter_Dry (0C, 40% RH)': {'temp': 0.0, 'rh': 40.0, 'steam': False},
    'Standard_Ambient (20C, 60% RH)': {'temp': 20.0, 'rh': 60.0, 'steam': False},
    'Summer_Arid (35C, 20% RH)': {'temp': 35.0, 'rh': 20.0, 'steam': False},
    'Summer_Tropical (35C, 90% RH)': {'temp': 35.0, 'rh': 90.0, 'steam': False},
    'Steam_Chamber (65C, 100% RH)': {'temp': 65.0, 'rh': 100.0, 'steam': True}
}

automation_tiers = ['Manual', 'Semi-Auto', 'Fully-Auto']
results = []

for climate_name, conditions in climates.items():
    for tier in automation_tiers:
        curing_days, cycle_days, strength, cost = simulate_curing_cycle(
            ensemble_model, scaler, sample_mix, target_str, 
            conditions['temp'], conditions['rh'], tier, conditions['steam']
        )
        
        if curing_days:
            results.append({
                'Climate_Profile': climate_name,
                'Automation': tier,
                'Cycle_Days': cycle_days,
                'Total_Cost_USD': cost['Total']
            })

# ==========================================
# CELL 7: OPTIMIZATION RESULTS ANALYSIS
# ==========================================
results_df = pd.DataFrame(results)

print("\n--- MATRIX OUTPUT: TOP 5 EFFICIENT CONFIGURATIONS ---")
top_configs = results_df.nsmallest(5, 'Total_Cost_USD').reset_index(drop=True)
print(top_configs.to_string(index=False))

optimal = top_configs.iloc[0]
print("\n--- FINAL ENGINEERING DIRECTIVE ---")
print(f"To achieve {target_str} MPa minimum demoulding strength:")
print(f"Implement: {optimal['Automation']} handling in {optimal['Climate_Profile']} conditions.")
print(f"Projected Element Cost: ${optimal['Total_Cost_USD']:.2f}")
print(f"Projected Cycle Time: {optimal['Cycle_Days']} Days")

print("\nExporting model components...")
joblib.dump(ensemble_model, 'optimized_regression_model.pkl')
joblib.dump(scaler, 'feature_scaler.pkl')
print("Export complete.")
