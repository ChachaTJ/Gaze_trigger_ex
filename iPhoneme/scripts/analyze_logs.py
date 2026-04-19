#!/usr/bin/env python3
"""
iPhoneme Experiment Log Analyzer

Reads JSONL log files and produces per-condition summary tables.
Computes primary and secondary metrics from experiment data.

Usage:
    python3 analyze_logs.py --input data/logs/ --output data/results/
    python3 analyze_logs.py --input path/to/session.jsonl

Requirements:
    pip install pandas matplotlib
"""

import json
import os
import sys
import argparse
from pathlib import Path
from collections import defaultdict

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False
    print("Warning: pandas not installed. Install with: pip install pandas")

try:
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False
    print("Warning: matplotlib not installed. Install with: pip install matplotlib")


def load_jsonl(filepath):
    """Load events from a JSONL file."""
    events = []
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return events


def find_jsonl_files(input_path):
    """Find all JSONL files in a directory tree."""
    path = Path(input_path)
    if path.is_file():
        return [path]
    return sorted(path.rglob('*.jsonl'))


def compute_trial_metrics(events):
    """Compute per-trial metrics from events."""
    trials = []
    current_trial = {}
    
    for event in events:
        etype = event.get('eventType', '')
        payload = event.get('payload', {})
        
        if etype == 'task_start':
            current_trial = {
                'participantId': event.get('participantId', ''),
                'sessionId': event.get('sessionId', ''),
                'condition': event.get('condition', ''),
                'taskType': event.get('taskType', ''),
                'trialIndex': event.get('trialIndex', -1),
                'startTime': event.get('timestamp', 0),
                'falseActivations': 0,
                'wrongTarget': False,
                'retries': 0,
                'success': None,
                'completionTimeMs': None,
                'phonemeEvents': 0,
                'dwellCommits': 0,
                'targetEnters': 0,
                'targetLeaves': 0,
                'isPractice': payload.get('isPractice', False),
                'selectionAccuracy': None
            }
        
        elif etype == 'task_end':
            current_trial['success'] = payload.get('success', None)
            current_trial['completionTimeMs'] = payload.get('completionTimeMs', None)
            current_trial['endTime'] = event.get('timestamp', 0)
            
            # Additional metrics from payload
            if 'falseActivations' in payload:
                current_trial['falseActivations'] = payload['falseActivations']
            if 'wrongTarget' in payload:
                current_trial['wrongTarget'] = payload['wrongTarget']
            if 'f1Score' in payload:
                current_trial['selectionAccuracy'] = payload['f1Score']
            if 'swipeCount' in payload:
                current_trial['swipeCount'] = payload['swipeCount']
            if 'overshootCount' in payload:
                current_trial['overshootCount'] = payload['overshootCount']
            
            if not current_trial.get('isPractice', False):
                trials.append(dict(current_trial))
        
        elif etype == 'error_event':
            if current_trial:
                if payload.get('type') == 'wrong_target':
                    current_trial['wrongTarget'] = True
                    current_trial['falseActivations'] += 1
                elif payload.get('type') == 'premature_activation':
                    current_trial['falseActivations'] += 1
        
        elif etype == 'phoneme_event':
            if current_trial:
                current_trial['phonemeEvents'] += 1
        
        elif etype == 'dwell_commit':
            if current_trial:
                current_trial['dwellCommits'] += 1
        
        elif etype == 'target_enter':
            if current_trial:
                current_trial['targetEnters'] += 1
        
        elif etype == 'target_leave':
            if current_trial:
                current_trial['targetLeaves'] += 1
    
    return trials


def compute_condition_summary(trials):
    """Compute per-condition summary statistics."""
    summaries = {}
    
    conditions = set(t['condition'] for t in trials)
    
    for cond in conditions:
        cond_trials = [t for t in trials if t['condition'] == cond]
        
        if not cond_trials:
            continue
        
        total = len(cond_trials)
        successes = sum(1 for t in cond_trials if t.get('success'))
        
        completion_times = [t['completionTimeMs'] for t in cond_trials 
                          if t.get('completionTimeMs') is not None and t.get('success')]
        
        false_acts = sum(t.get('falseActivations', 0) for t in cond_trials)
        wrong_targets = sum(1 for t in cond_trials if t.get('wrongTarget'))
        
        accuracies = [t['selectionAccuracy'] for t in cond_trials 
                     if t.get('selectionAccuracy') is not None]
        
        summary = {
            'condition': cond,
            'total_trials': total,
            'successful_trials': successes,
            'completion_rate': successes / total if total > 0 else 0,
            'mean_completion_time_ms': sum(completion_times) / len(completion_times) if completion_times else None,
            'median_completion_time_ms': sorted(completion_times)[len(completion_times)//2] if completion_times else None,
            'false_activations': false_acts,
            'false_activation_rate': false_acts / total if total > 0 else 0,
            'wrong_target_count': wrong_targets,
            'mean_selection_accuracy': sum(accuracies) / len(accuracies) if accuracies else None,
            'total_phoneme_events': sum(t.get('phonemeEvents', 0) for t in cond_trials),
            'total_dwell_commits': sum(t.get('dwellCommits', 0) for t in cond_trials)
        }
        
        summaries[cond] = summary
    
    return summaries


def compute_task_summary(trials):
    """Compute per-task-type summary statistics."""
    summaries = {}
    
    task_types = set(t['taskType'] for t in trials)
    
    for task in task_types:
        task_trials = [t for t in trials if t['taskType'] == task]
        
        for cond in set(t['condition'] for t in task_trials):
            key = f"{task}__{cond}"
            ct = [t for t in task_trials if t['condition'] == cond]
            
            total = len(ct)
            successes = sum(1 for t in ct if t.get('success'))
            
            completion_times = [t['completionTimeMs'] for t in ct 
                              if t.get('completionTimeMs') is not None and t.get('success')]
            
            summaries[key] = {
                'task': task,
                'condition': cond,
                'total': total,
                'successes': successes,
                'rate': successes / total if total > 0 else 0,
                'mean_time': sum(completion_times) / len(completion_times) if completion_times else None,
                'false_acts': sum(t.get('falseActivations', 0) for t in ct)
            }
    
    return summaries


def extract_questionnaire_data(events):
    """Extract questionnaire responses."""
    responses = []
    for event in events:
        if event.get('eventType') == 'questionnaire_submitted':
            responses.append(event.get('payload', {}))
    return responses


def print_summary(summaries, task_summaries, questionnaire_data):
    """Print a formatted summary to console."""
    print("\n" + "=" * 70)
    print("iPhoneme Experiment — Condition-Level Summary")
    print("=" * 70)
    
    for cond, s in sorted(summaries.items()):
        print(f"\n--- {cond.upper()} ---")
        print(f"  Trials:              {s['total_trials']}")
        print(f"  Completion Rate:     {s['completion_rate']:.1%}")
        if s['mean_completion_time_ms'] is not None:
            print(f"  Mean Completion:     {s['mean_completion_time_ms']:.0f} ms")
        if s['median_completion_time_ms'] is not None:
            print(f"  Median Completion:   {s['median_completion_time_ms']:.0f} ms")
        print(f"  False Activations:   {s['false_activations']} ({s['false_activation_rate']:.2f}/trial)")
        print(f"  Wrong Targets:       {s['wrong_target_count']}")
        if s['mean_selection_accuracy'] is not None:
            print(f"  Text Select Accuracy:{s['mean_selection_accuracy']:.2%}")
        print(f"  Phoneme Events:      {s['total_phoneme_events']}")
        print(f"  Dwell Commits:       {s['total_dwell_commits']}")
    
    print("\n" + "=" * 70)
    print("Task × Condition Breakdown")
    print("=" * 70)
    
    for key, s in sorted(task_summaries.items()):
        print(f"  {s['task']:25s} | {s['condition']:18s} | "
              f"Rate: {s['rate']:.0%} | "
              f"Time: {s['mean_time']:.0f}ms" if s['mean_time'] else 
              f"  {s['task']:25s} | {s['condition']:18s} | "
              f"Rate: {s['rate']:.0%} | Time: N/A")
    
    if questionnaire_data:
        print("\n" + "=" * 70)
        print("Questionnaire Responses")
        print("=" * 70)
        for q in questionnaire_data:
            qtype = q.get('type', 'unknown')
            cond = q.get('condition', '?')
            responses = q.get('responses', {})
            print(f"\n  [{qtype}] Condition: {cond}")
            for key, val in responses.items():
                if val is not None and key != 'comments':
                    print(f"    {key}: {val}")
            if responses.get('comments'):
                print(f"    Comments: {responses['comments']}")


def save_csv(trials, summaries, output_dir):
    """Save results as CSV files using pandas."""
    if not HAS_PANDAS:
        print("Skipping CSV export (pandas not available)")
        return
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Trial-level CSV
    df_trials = pd.DataFrame(trials)
    trials_path = os.path.join(output_dir, 'trials.csv')
    df_trials.to_csv(trials_path, index=False)
    print(f"Saved: {trials_path}")
    
    # Condition summary CSV
    df_summary = pd.DataFrame(summaries.values())
    summary_path = os.path.join(output_dir, 'condition_summary.csv')
    df_summary.to_csv(summary_path, index=False)
    print(f"Saved: {summary_path}")


def plot_results(summaries, output_dir):
    """Generate basic plots."""
    if not HAS_MATPLOTLIB or not HAS_PANDAS:
        print("Skipping plots (matplotlib/pandas not available)")
        return
    
    os.makedirs(output_dir, exist_ok=True)
    
    conditions = list(summaries.keys())
    
    if len(conditions) < 2:
        print("Not enough conditions for comparative plots")
        return
    
    fig, axes = plt.subplots(1, 3, figsize=(14, 5))
    fig.suptitle('iPhoneme Experiment Results', fontsize=14, fontweight='bold')
    
    # Completion Rate
    rates = [summaries[c]['completion_rate'] * 100 for c in conditions]
    colors = ['#70a1ff', '#7bed9f', '#a29bfe'][:len(conditions)]
    axes[0].bar(conditions, rates, color=colors)
    axes[0].set_ylabel('Completion Rate (%)')
    axes[0].set_title('Task Completion Rate')
    axes[0].set_ylim(0, 105)
    
    # Completion Time
    times = [summaries[c].get('mean_completion_time_ms', 0) or 0 for c in conditions]
    axes[1].bar(conditions, times, color=colors)
    axes[1].set_ylabel('Mean Time (ms)')
    axes[1].set_title('Completion Time')
    
    # False Activations
    fas = [summaries[c]['false_activation_rate'] for c in conditions]
    axes[2].bar(conditions, fas, color=colors)
    axes[2].set_ylabel('False Activations / Trial')
    axes[2].set_title('False Activation Rate')
    
    plt.tight_layout()
    plot_path = os.path.join(output_dir, 'summary_plot.png')
    plt.savefig(plot_path, dpi=150, bbox_inches='tight')
    print(f"Saved: {plot_path}")
    plt.close()


def main():
    parser = argparse.ArgumentParser(description='iPhoneme Experiment Log Analyzer')
    parser.add_argument('--input', '-i', required=True, help='Input JSONL file or directory')
    parser.add_argument('--output', '-o', default='data/results/', help='Output directory for CSVs and plots')
    args = parser.parse_args()
    
    # Find and load log files
    files = find_jsonl_files(args.input)
    if not files:
        print(f"No JSONL files found in: {args.input}")
        sys.exit(1)
    
    print(f"Found {len(files)} log file(s)")
    
    all_events = []
    for f in files:
        events = load_jsonl(f)
        all_events.extend(events)
        print(f"  {f.name}: {len(events)} events")
    
    print(f"\nTotal events: {len(all_events)}")
    
    # Compute metrics
    trials = compute_trial_metrics(all_events)
    print(f"Total experiment trials: {len(trials)}")
    
    if not trials:
        print("No completed trials found. Check if logs contain task_start/task_end events.")
        sys.exit(0)
    
    summaries = compute_condition_summary(trials)
    task_summaries = compute_task_summary(trials)
    questionnaire_data = extract_questionnaire_data(all_events)
    
    # Print summary
    print_summary(summaries, task_summaries, questionnaire_data)
    
    # Save CSV and plots
    save_csv(trials, summaries, args.output)
    plot_results(summaries, args.output)
    
    print(f"\nDone! Results saved to: {args.output}")


if __name__ == '__main__':
    main()
