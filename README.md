# Car-FS

O **Car-FS** é um simulador de voo online, que roda no navegador. Ele é inspirado no **geo-fs**, mas com uma proposta totalmente open-source. Ele tem uma mecânica bem simples; importa um pacote de javascript que contém todo o globo terrestre em 3D, renderizando tudo, e mantendo tudo em **60 FPS**. Está hospedado na vercel e roda em qualquer navegador.

---

## Engenharia do software

O **Car-FS** tem uma estrutura simples, tendo um diretório principal, sendo o **geofs-edu**, justamente por ser uma inspiração educacional do modelo já existente, que se subdivide em três diretórios menores, o **assets**, o **css** e o **js**, além disso, há o **index.html**, responsável por criar o site hospedeiro. 

- Dentro da pasta **assets**, há os modelos das aeronaves presentes no jogo. Obs: Os modelos foram obtidos de outros projetos open-source disponíveis no github, além de modelos gratuitos e open-source disponíveis na web.
- Já dentro da pasta **css**, está contido o script **style.css**, responsável por dar cores vivas aos alertas de colisão, além das informações básicas do voo.
- Por último, há a pasta **js**, que abriga todos cálculos, ponto de visão das câmeras, a física da atmosfera (tipo quando o nariz do avião é colocado para baixo, e o avião, desce e ganha velocidade), além da importação do globo terrestre.

## Tecnologias

- HTML5
- CSS3
- Javacript
- Vercel
