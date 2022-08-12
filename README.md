<h1>
<a href="https://interpret.ml/gam-changer/"><img src='https://i.imgur.com/njlqCrQ.png' width='100%'></a>
</h1>

Interactive visualization tool to help domain experts and data scientist easily and responsibly edit Generalized Additive Models (GAMs).

[![build](https://github.com/interpretml/GAMChanger/workflows/build/badge.svg)](https://github.com/interpretml/gam-changer/actions)
[![pypi](https://img.shields.io/pypi/v/gamchanger?color=blue)](https://pypi.org/project/gamchanger/)
[![license](https://img.shields.io/pypi/l/gamchanger?color=blue)](https://github.com/interpretml/gam-changer/blob/master/LICENSE)
[![arxiv badge](https://img.shields.io/badge/arXiv-2112.03245-red)](https://arxiv.org/abs/2112.03245)

<a href="https://youtu.be/D6whtfInqTc" target="_blank"><img src="https://i.imgur.com/J3C0aov.png" style="max-width:100%;"></a>

<!-- For more information, check out our manuscript:

[**GAM Changer: Editing Generalized Additive Models with Interactive Visualization**](https://arxiv.org/abs/2112.03245).
Zijie J. Wang, Alex Kale, Harsha Nori, Peter Stella, Mark Nunnally, Duen Horng Chau, Mihaela Vorvoreanu, Jennifer Wortman Vaughan, Rich Caruana.
*arXiv:2112.03245, 2021.* -->

## Features

<img align="center" width="600px" src="https://user-images.githubusercontent.com/15007159/184291928-c675b83e-be82-4206-bd30-47dc93008fec.gif">

## Live Demo

For a live demo, visit: http://interpret.ml/gam-changer/

You can use this demo to edit your own GAMs: choose the `my model` tab and upload the `model.json` (model weights) and `sample.json` (sample data to evaluate the model).

If you use [EBM](https://github.com/interpretml/interpret), you can generate these two files easily with the GAM Changer python package.

```shell
# First install the GAM Changer python package
pip install gamchanger
```

```python
import gamchanger as gc
from json import dump

# Extract model weights
model_data = gc.get_model_data(ebm)

# Generate sample data
sample_data = gc.get_sample_data(ebm, x_test, y_test)

# Save to `model.json` and `sample.json`
dump(model_data, open('./model.json', 'w'))
dump(sample_data, open('./sample.json', 'w'))
```

## In Computational Notebooks

You can use GAM Changer directly in your computational notebooks (e.g., Jupyter Notebook, Google Colab).

```python
# Install the GAM Changer python package
!pip install gamchanger

import gamchanger as gc

# Load GAM Changer with the model and sample data
gc.visualize(ebm, x_feed, y_feed)
```

Example notebook: [Use GAM Changer in Google Colab](https://colab.research.google.com/drive/1OgAVZKqs2VwmY13QuOjCxlOEyexsYjtm?usp=sharing).

## Load Edited Models

After finishing editing a model, you can save the new model along with all the editing history to a `*.gamchanger` file by clicking the save button. You can load the new model in Python:

```python
from json import load
import gamchanger as gc

# Load the `*.gamchanger` file
gc_dict = load(open('./edit-8-27-2021.gamchanger', 'r'))

# This will return a deep copy of your original EBM where edits are applied
new_ebm = gc.get_edited_model(ebm, gc_dict)
```

## Development

Clone or download this repository:

```bash
git clone git@github.com:interpretml/gam-changer.git

# use degit if you don't want to download commit histories
degit interpretml/gam-changer.git
```

Install the dependencies:

```bash
npm install
```

Then run GAM Changer:

```bash
npm run dev
```

Navigate to [localhost:5000](https://localhost:5005). You should see GAM Changer running in your browser :)

## Credits

GAM Changer is created by <a href="https://zijie.wang">Jay Wang</a>,
<a href="http://students.washington.edu/kalea/">Alex Kale</a>,
<a href="https://www.linkedin.com/in/harshanori/">Harsha Nori</a>,
<a href="https://nyulangone.org/doctors/1548522964/peter-a-stella">Peter Stella</a>,
<a href="https://nyulangone.org/doctors/1144385360/mark-e-nunnally">Mark Nunnally</a>,
<a href="https://www.cc.gatech.edu/~dchau/">Polo Chau</a>,
<a href="https://www.microsoft.com/en-us/research/people/mivorvor/">Mickey Vorvoreanu</a>,
<a href="http://www.jennwv.com">Jenn Wortman Vaughan</a>,
and <a href="https://www.microsoft.com/en-us/research/people/rcaruana/">Rich Caruana</a>,
which was the result of a research collaboration between
Microsoft Research, NYU Langone Health, Georgia Tech and University of Washington.
Jay Wang and Alex Kale were summer interns at Microsoft Research.

We thank Steven Drucker, Adam Fourney, Saleema Amershi, Dean Carignan, Rob DeLine, Haekyu Park, and the InterpretML team for their support and constructive feedback.

## Citation

```bibTeX
@article{wangGAMChangerEditing2021,
  title = {{{GAM Changer}}: {{Editing Generalized Additive Models}} with {{Interactive Visualization}}},
  shorttitle = {{{GAM Changer}}},
  author = {Wang, Zijie J. and Kale, Alex and Nori, Harsha and Stella, Peter and Nunnally, Mark and Chau, Duen Horng and Vorvoreanu, Mihaela and Vaughan, Jennifer Wortman and Caruana, Rich},
  year = {2021},
  month = dec,
  journal = {arXiv:2112.03245 [cs]},
  url = {https://interpret.ml/gam-changer},
  archiveprefix = {arXiv}
}
```

## License

The software is available under the [MIT License](./LICENSE).

## Contact

If you have any questions, feel free to [open an issue](https://github.com/interpretml/gam-changer/issues/new) or contact [Jay Wang](https://zijie.wang).
