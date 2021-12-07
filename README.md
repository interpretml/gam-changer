<h1>
<a href="https://interpret.ml/gam-changer/"><img src='https://i.imgur.com/WMwT193.png' width='100%'></a>
</h1>

An interactive visualization system designed to helps domain experts responsibly edit Generalized Additive Models (GAMs).

[![build](https://github.com/interpretml/GAMChanger/workflows/build/badge.svg)](https://github.com/interpretml/gam-changer/actions)
[![pypi](https://img.shields.io/pypi/v/gamchanger?color=blue)](https://pypi.org/project/gamchanger/)
[![license](https://img.shields.io/pypi/l/gamchanger?color=blue)](https://github.com/interpretml/gam-changer/blob/master/LICENSE)
[![arxiv badge](https://img.shields.io/badge/arXiv-2112.03245-red)](https://arxiv.org/abs/2112.03245)

<a href="https://youtu.be/2gVSoPoSeJ8" target="_blank"><img src="https://i.imgur.com/TqQQ8gH.png" style="max-width:100%;"></a>

For more information, check out our manuscript:

[**GAM Changer: Editing Generalized Additive Models with Interactive Visualization**](https://arxiv.org/abs/2004.15004).
Zijie J. Wang, Alex Kale, Harsha Nori, Peter Stella, Mark Nunnally, Duen Horng Chau, Mihaela Vorvoreanu, Jennifer Wortman Vaughan, Rich Caruana.
*Research2Clinics Workshop at NeurIPS, 2021.*

## Live Demo

For a live demo, visit: http://interpret.ml/gam-changer/

## Running Locally

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

Navigate to [localhost:5000](https://localhost:5000). You should see GAM Changer running in your browser :)

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

We thank Steven Drucker, Adam Fourney, Saleema Amershi, Dean Carignan, Rob DeLine, and the InterpretML team for their support and constructive feedback.

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
