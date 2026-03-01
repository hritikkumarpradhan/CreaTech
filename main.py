from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import backend

app = FastAPI(title="CreaTech AI Precast Optimizer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SimulationRequest(BaseModel):
    mix: str
    curing: str
    automation: str
    climate: str
    targetStrength: float

MIX_PROPORTIONS = {
    'm30': { 'Cement': 300.0, 'Blast_Furnace_Slag': 0.0, 'Fly_Ash': 50.0, 'Water': 170.0, 'Superplasticizer': 3.0, 'Coarse_Aggregate': 1050.0, 'Fine_Aggregate': 800.0 },
    'm40': { 'Cement': 350.0, 'Blast_Furnace_Slag': 0.0, 'Fly_Ash': 100.0, 'Water': 160.0, 'Superplasticizer': 5.0, 'Coarse_Aggregate': 1000.0, 'Fine_Aggregate': 750.0 },
    'm50': { 'Cement': 400.0, 'Blast_Furnace_Slag': 50.0, 'Fly_Ash': 100.0, 'Water': 150.0, 'Superplasticizer': 6.0, 'Coarse_Aggregate': 950.0, 'Fine_Aggregate': 700.0 },
    'scc': { 'Cement': 450.0, 'Blast_Furnace_Slag': 0.0, 'Fly_Ash': 150.0, 'Water': 180.0, 'Superplasticizer': 10.0, 'Coarse_Aggregate': 800.0, 'Fine_Aggregate': 850.0 }
}

CLIMATE_PROFILES = {
    'cold': {'temp': 5.0, 'rh': 40.0},
    'moderate': {'temp': 20.0, 'rh': 60.0},
    'hot': {'temp': 35.0, 'rh': 20.0},
    'humid': {'temp': 35.0, 'rh': 90.0}
}

AUTOMATION_MAP = {
    'manual': 'Manual',
    'semi': 'Semi-Auto',
    'full': 'Fully-Auto'
}

# Provide some curing time multipliers to align with physical intuitions
CURING_TIME_MULTIPLIER = {
    'ambient': 1.0,
    'water': 0.85,
    'steam': 0.35,
    'heated_formwork': 0.45
}

@app.post("/simulate")
def simulate(request: SimulationRequest):
    try:
        base_mix = MIX_PROPORTIONS.get(request.mix, MIX_PROPORTIONS['m40'])
        temp_c = CLIMATE_PROFILES.get(request.climate, CLIMATE_PROFILES['moderate'])['temp']
        rh = CLIMATE_PROFILES.get(request.climate, CLIMATE_PROFILES['moderate'])['rh']
        auto_tier = AUTOMATION_MAP.get(request.automation, 'Semi-Auto')
        is_steam = (request.curing == 'steam' or request.curing == 'heated_formwork')
        
        # Original backend executes days step by step. We pass the inputs directly.
        curing_days, cycle_days, strength, cost = backend.simulate_curing_cycle(
            backend.ensemble_model, 
            backend.scaler, 
            base_mix, 
            request.targetStrength, 
            temp_c, 
            rh, 
            auto_tier, 
            is_steam
        )
        
        if curing_days is None:
            # If 28 days pass and target format isn't reached, handle it by returning arbitrary max limits
            finalCycleTime = 28 * 24
            mat_cost = backend.calculate_material_cost(base_mix) * 80
            finalCost = (mat_cost + 500) * 1.5 
            efficiencyGain = -50.0
            return {
                "status": "success",
                "finalCycleTime": finalCycleTime,
                "finalCost": finalCost,
                "efficiencyGain": efficiencyGain,
                "timeTensionHrs": finalCycleTime,
                "matCost": mat_cost,
                "cureCost": 0.0,
                "strength": 0.0
            }

        # The ML returns cycle_days generally in days (minimum 1 day). 
        # For precast, we expect hours, so let's parse cycle_days into hours and apply curing multiplier
        # (Assuming backend days represents a rough proxy for equivalent age progress)
        curing_modifier = CURING_TIME_MULTIPLIER.get(request.curing, 1.0)
        
        finalCycleTime = (cycle_days * 24) * curing_modifier
        
        # Extrapolated costs from USD to INR
        INR_CONV = 80
        mat_cost_inr = cost['Material'] * INR_CONV
        labor_cost_inr = cost['Labor'] * INR_CONV
        equipment_cost_inr = cost['Equipment'] * INR_CONV
        energy_cost_inr = cost['Energy'] * INR_CONV
        
        # Add a specific overhead if steam is used or specific curing
        if request.curing == "water": energy_cost_inr += 80
        if request.curing == "heated_formwork": energy_cost_inr += 380
        
        finalCost = mat_cost_inr + labor_cost_inr + equipment_cost_inr + energy_cost_inr
        
        baseline_cycle = 24.0
        baseline_cost = 1200.0
        
        time_eff = ((baseline_cycle - finalCycleTime) / baseline_cycle) * 100
        cost_eff = ((baseline_cost - finalCost) / baseline_cost) * 100
        efficiencyGain = (time_eff * 0.7) + (cost_eff * 0.3)

        return {
            "status": "success",
            "finalCycleTime": finalCycleTime,
            "finalCost": finalCost,
            "efficiencyGain": efficiencyGain,
            "timeTensionHrs": finalCycleTime,
            "matCost": mat_cost_inr,
            "cureCost": energy_cost_inr,
            "strength": strength
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
