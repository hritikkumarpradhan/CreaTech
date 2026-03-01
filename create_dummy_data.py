import pandas as pd
import numpy as np

# Create dummy Concrete_Data.csv so the backend ML script can train without errors
np.random.seed(42)
n_samples = 500

data = {
    'Cement': np.random.uniform(100, 500, n_samples),
    'Blast_Furnace_Slag': np.random.uniform(0, 300, n_samples),
    'Fly_Ash': np.random.uniform(0, 200, n_samples),
    'Water': np.random.uniform(120, 240, n_samples),
    'Superplasticizer': np.random.uniform(0, 30, n_samples),
    'Coarse_Aggregate': np.random.uniform(800, 1100, n_samples),
    'Fine_Aggregate': np.random.uniform(500, 900, n_samples),
    'Age': np.random.choice([3, 7, 14, 28, 56, 90], n_samples),
    'Compressive_Strength': np.random.uniform(10, 80, n_samples)
}

df = pd.DataFrame(data)
df.to_csv("Concrete_Data.csv", index=False)
print("Dummy Concrete_Data.csv created successfully.")
