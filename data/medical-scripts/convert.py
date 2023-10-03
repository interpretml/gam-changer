from json import load, dump
import numpy as np

data = load(open('./public/data/medical-ebm-sample-5000.json', 'r'))

indexes = np.random.choice(range(5000), 1000, replace=False)

new_samples = []
new_labels = []
for i in indexes:
    new_samples.append(data['samples'][i])
    new_labels.append(data['labels'][i])

new_data = {
    'featureNames': data['featureNames'],
    'featureTypes': data['featureTypes'],
    'samples': new_samples,
    'labels': new_labels
}

dump(new_data, open('./public/data/medical-ebm-sample-1000.json', 'w'))