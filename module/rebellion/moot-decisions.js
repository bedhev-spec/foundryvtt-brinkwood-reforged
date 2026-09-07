const decision = (id, title, aspect, rank, choices, description) => Object.freeze({
  id,
  title,
  aspect,
  rank,
  choices: Object.freeze(choices),
  description,
});

/** Canonical Brinkwood 1.0.6 Moot decisions, transcribed from printed pages 90–92. */
export const MOOT_DECISIONS = Object.freeze([
  decision("MootOrgSafeRef01", "Safehouses or Refuges", "Organization", 1, ["Safehouses", "Refuges"], `As the rebellion grows, a split over strategy emerges. The safety of the Brinkwood is a true boon, and many advocate for expanding the rebellion’s presence within it. Others argue that the rebellion needs to be able to react quickly throughout Cardenfell, and call for resources to be diverted towards setting up safehouses in villages and towns.`),
  decision("MootOrgTallWide1", "Tall or Wide", "Organization", 1, ["Tall", "Wide"], `As your influence spreads through country and town, a disagreement arises as to whether your focus should be on bringing new folk into the fold or developing the villages and holdings that have already pledged their loyalty to the rebellion. Providing necessities to those still under vampiric rule is a sure way to win more supporters, but others advocate for building up your base, so that you can someday aid not just a few villages, but all of Cardenfell.`),
  decision("MootOrgLineSmg01", "Lines or Smugglers", "Organization", 2, ["Lines", "Smugglers"], `As your holdings grow, so too does your need for logistical distribution. Some argue that setting up formal, well-patrolled supply lines will allow you to quickly funnel a great many resources to where they are needed most. Others urge caution against such flagrant visibility. They instead suggest developing your relationships with smugglers so that a steady stream of hidden contraband can flow all over our territory and beyond.`),
  decision("MootOrgPropComp1", "Property and Compensation", "Organization", 2, ["Property", "Compensation"], `While private property is held as sacred among the vampires, your view is more lenient. Few voice much concern about seizing supplies and wealth from your oppressors, and it is a foregone conclusion that any seized factories and land will be handed over to the workers and peasants who work them. However, the issue of personal property is somewhat more contentious. Some argue for relying solely on trading in appropriated wealth and donations to sustain your movement, while others have proposed issuing “scrip,” redeemable for other rebellion resources, to traders and artisans when the rebellion needs to requisition goods.`),
  decision("MootOrgLawOrder1", "Law and Order", "Organization", 3, ["Law", "Order"], `As your movement grows into a society all its own, the question of law and order presses on the minds and hearts of many. Under vampire rule, there is little justice and seemingly arbitrary enforcement that primarily benefits the rich and powerful. As you work to build a new society, some argue that you should rebuild the Reeves of old as a corps of civil servants trained to non-violently handle most behavior currently deemed criminal. Others argue that your greatest threats are external rather than internal, and propose leaving justice and enforcement to local town councils and village moots, and instead focusing your organizing efforts on collective community defense.`),
  decision("MootFrcGuerPart1", "Guerrillas or Partisans", "Force", 1, ["Guerrillas", "Partisans"], `The first choice that must be made for any aspiring rebellion is whether to emphasize offense or defense. Some in the rebellion advocate for forming small, heavily drilled bands of guerrillas capable of striking deep in enemy territory. Others emphasize the value of training and equipping partisans that can go on to organize and train their own communities in the arts of sabotage and community defense.`),
  decision("MootFrcPowdAsh01", "Powder or Ash", "Force", 1, ["Powder", "Ash"], `The benefits of black powder and ashwood are obvious, but both require training and care both to produce and use effectively. Should you have your forces focus on sharpening stakes or making bombs?`),
  decision("MootFrcVangLieu1", "Vanguards and Lieutenants", "Force", 2, ["Vanguards", "Lieutenants"], `As your forces expand, the need for leadership emerges. As bands elect their own leaders, some advocate for training and specializing these lieutenants, offering training in both strategy and tactics. Others argue that these resources would be better served training “vanguards,” specialist organizers who are trained in strategy, politics, and ideology. These vanguards would be placed into bands and communities to train, motivate, and educate militias and units as a whole.`),
  decision("MootFrcSickDise1", "Sickness and Disease", "Force", 2, ["Sickness", "Disease"], `Throughout history, illness has stalked armies. Your forces must eventually confront this reality, and the decision must be made whether to focus your attention on widespread preventative practice and sanitation, or to instead focus resources on recruiting and training skilled healers who can assist with outbreaks of serious illness, whether in your camps or in Cardenfell at large.`),
  decision("MootFrcRustDese1", "Rustcoats and Deserters", "Force", 3, ["Retrain", "Fast Track"], `As the tide turns in your favor, many rustcoats have begun deserting their vampiric lieges, and some are eager to prove their loyalty to the revolution on the front lines. Some of your veterans grumble about this, as retraining rustcoats and integrating them into your forces may prove a logistical nightmare. Others, however, point to the in-depth knowledge of vampire tactics and fighting experience of these deserters, and advocate for their “fast tracking” into the rebellion’s military.`),
  decision("MootInfQuilSilv1", "The Quill or the Silver", "Influence", 1, ["The Quill", "the Silver"], `In order for the rebellion to succeed, it must win allies. A quick and easy shortcut is bribery, using stolen silver and supplies to offer quick relief to the most needy, or to corrupt the servants of your enemies. Alternatively, these resources could be used to hire and train teachers, educators, and organizers capable of running underground “circles” that will feed both the bodies and minds of your recruits.`),
  decision("MootInfRumoFact1", "Rumors or Facts", "Influence", 2, ["Rumors", "Facts"], `As your influence and spy networks develop, you have the opportunity to influence both the popular perception of your movement as well as to counteract the propaganda of the vampires. Your scholars and intellectuals debate whether it is better to focus on using rumors of the Conclave’s deeds and victories to attract support, or whether to instead focus on educating the general populace as to the true nature of vampirism.`),
  decision("MootInfServScam1", "Servants or Scampers", "Influence", 2, ["Servants", "Scampers"], `Your agents and spymasters have come to you asking to expand the intelligence network to the house servants of vampiric manors, or the urban cogscampers of factories. Servants in vampire holdings make excellent spies—nearly invisible to the monsters they serve, they are positioned perfectly to feed valuable intelligence back to the rebellion. And cogscampers serve a valuable role in the workings of more urban events, able to quickly pass messages, organize sabotage, and keep an eye on the comings and goings of enemies within towns and factories.`),
  decision("MootInfWispTrea1", "Wisps and Treachery", "Influence", 3, ["Wisps", "Treachery"], `As your intelligence network reaches beyond your shores, infiltration and counterintelligence begin to become serious issues. Your spies and informants are split on how to handle the threats of wisps and other vampire collaborators infiltrating your networks. Some argue that you should prioritize rooting out and liquidating threats as quickly as possible, while others advocate a more velvet glove, focusing on long-term ploys aimed at turning enemy agents to our cause.`),
]);

export function mootDecisionPackDocument(source, sort = 0) {
  return {
    _key: `!items!${source.id}`,
    _id: source.id,
    name: source.title,
    type: "moot_decision",
    img: "icons/svg/item-bag.svg",
    system: {
      description: `<p>${source.description}</p>`,
      choice: { 0: source.choices[0], 1: source.choices[1] },
      aspect: source.aspect,
      rank: source.rank,
    },
    effects: [],
    flags: {},
    folder: null,
    sort,
    ownership: { default: 0 },
  };
}
