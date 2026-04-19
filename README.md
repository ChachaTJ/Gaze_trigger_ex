# Neural Phoneme Decoder - Your Trained 92% Model

**CPU Version - No GPU Required!**

## Quick Start

1. **Install dependencies:**
```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
```

2. **Run web interface:**
```bash
python web_ui.py
```

3. **Open browser:** http://localhost:5000

4. **Drag & drop your neural data file!**

## Performance
- Accuracy: ~92% (same as GPU version)
- Speed: 2-5 seconds per sample on CPU

## File Formats
- CSV: [time_steps, 512]
- HDF5: key 'neural_data' or 'data'
- MAT: variable 'neural_data' or 'data'

Enjoy! 🎉
