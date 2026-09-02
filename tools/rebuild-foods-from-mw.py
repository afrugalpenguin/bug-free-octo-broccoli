import json, io, re, collections

MW = {r['code']: r for r in json.load(io.open('/tmp/mw.json', encoding='utf-8'))}
KEYS = json.load(io.open('/tmp/keys.json', encoding='utf-8'))
PROPOSED = json.load(io.open('/tmp/proposed.json', encoding='utf-8'))

# My matches. Where the auto-proposal was right I left it; everything else I
# searched by hand. "cooked" values only where the recipe buys it pre-cooked.
M = {
 'allspice':'13-801','anchovies_oil':'16-448','apple_sauce':'17-851','avocado':'14-039',
 'baby_potato':'13-618','balsamic':'17-339','banana':'14-318','beef_mince_5':'18-508',
 'beef_mince_12':'18-469','beef_stock':'17-774','beef_topside_roast':'18-085','bok_choy':'13-516',
 'bread_fresh':'11-986','bread_wholemeal':'11-986','breadcrumbs_wholemeal':None,
 'broccoli':'13-502','brown_rice_dry':'11-866','butter':'17-685','butter_beans_drained':'13-559',
 'butternut_squash':'13-355','cannellini_drained':'13-666','capers':None,'carrot':'13-496',
 'cauliflower':'13-512','celery':'13-636','cheddar':'12-346','cherry_tomatoes':'13-519',
 'chia_seeds':None,'chicken_breast':'18-290','chicken_roast_meat':'18-297',
 'chicken_sausage':None,'chicken_stock':'17-774','chicken_stock_cube':'17-726',
 'chicken_thigh_bonein':'18-298','chicken_thigh_boneless':'18-289','chickpeas_drained':'13-670',
 'chilli_flakes':'13-873','chilli_oil':'17-038','chopped_tomatoes':'13-530','chorizo_cooking':'19-516',
 'cider_vinegar':'17-339','cocoa':'12-545','coconut_milk':'14-889','coconut_milk_light':'14-890',
 'cornflour':'11-1045','courgette':'13-627','couscous_dry':'11-901','creatine':None,
 'creme_fraiche':'12-336','creme_fraiche_half':'12-336','cucumber':'13-523','cumin':'13-889',
 'dark_chocolate':'17-491','egg':'12-937','fajita_spice':None,'fennel_seeds':'13-827',
 'feta':'12-525','feta_reduced_fat':None,'fresh_herbs':'13-888','fresh_pasta':'11-726',
 'frozen_berries':'14-375','frozen_gyoza':None,'frozen_onion':'13-499','frozen_peas':'13-527',
 'frozen_spinach':'13-521','gammon_cooked':'19-021','garam_masala':'13-829','garlic':'13-244',
 'garlic_bread':None,'garlic_granules':'13-830','ginger':'13-890','grain_pouch':'11-864',
 'gravy_made':'17-725','greek_yoghurt':'12-555','greek_yoghurt_0':'12-379',
 'green_lentils_cooked':'13-661','ground_coriander':'13-875','halloumi':'12-496',
 'ham_sliced':'19-496','harissa':None,'honey':'17-050','hummus':'13-556','jalapeno_brine':None,
 'jalapenos_jarred':None,'kidney_beans_drained':'13-660','korma_paste':None,
 'lasagne_sheets':'11-716','leek':'13-624','lemon_juice':'14-277','lime_juice':'14-279',
 'lime_pickle':None,'linguine_dry':'11-716','mango':'13-273','mango_chutney':'17-343',
 'milk_semi':None,'mirin':None,'miso_soup_sachet':None,'mixed_beans_drained':'13-660',
 'mozzarella':'12-360','mozzarella_pearls':'12-360','mushrooms':'13-293','mustard':'17-364',
 'mustard_seeds':None,'naan':None,'nori':'13-340','oats':'11-788','olive_oil':'17-038',
 'olives_drained':'14-340','onion':'13-499','oregano':'13-878','orzo_dry':'11-716',
 'pancetta':'19-497','parmesan':'12-526','passata':'13-530','pasta_dry':'11-716',
 'peanut_butter':'14-892','peanuts_roasted':'14-834','pepper':'13-524','pepperoni':'19-517',
 'pitta_wholemeal':None,'pizza_dough':'11-1016','pomegranate_seeds':'14-226',
 'pork_shoulder_roast':'18-602','prawns_cooked':'16-389','prawns_raw':'16-387',
 'protein_powder':None,'quinoa_cooked':None,'radish':'13-656','raisins':'14-393',
 'red_chilli':'13-317','red_lentils_dry':'13-657','red_onion':'13-499','red_wine':'17-752',
 'red_wine_vinegar':'17-339','rice_vinegar':'17-339','ricotta':'12-176','risotto_rice':'11-878',
 'roasting_veg':None,'salad_leaves':'13-520','salmon_fillet':'16-356','seeds_nuts':'14-845',
 'sesame_oil':'17-043','shallot':'13-342','smoked_mackerel':'16-414','smoked_paprika':'13-879',
 'smoked_salmon':'16-412','soy_sauce':'17-721','spice_mix':None,'spinach_fresh':'13-521',
 'spring_onion':'13-352','stewing_steak':'18-076','stir_fry_veg':'13-543','stock_cube':'17-726',
 'stock_made':'17-774','sugar':'17-063','sun_dried_tomato_paste':None,
 'sun_dried_tomatoes_oil':None,'sweet_potato':'13-463','sweetcorn_drained':'13-529',
 'tahini':'14-847','tandoori_spice':None,'tenderstem_broccoli':'13-502','tomato_puree':'13-531',
 'tomatoes':'13-519','tortilla_chips':'17-644','tortilla_wrap':'11-925','tuna_drained':'16-416',
 'turmeric':'13-861','vegetable_stock':'17-774','vegetable_stock_cube':'17-727',
 'wasabi_paste':None,'white_cabbage':None,'white_sauce_jar':None,'white_wine_vinegar':'17-339',
 'wholemeal_roll':'11-986','worcestershire':'17-723','yorkshire_pudding':'11-1146',
 'basa_fillet':None,'edamame':None,'mini_corn':None,
}

# Where I deliberately took a cooked value, and why.
PROXY = {
 'beef_stock':'M&W only has chicken stock made up with water; stock is stock at this dilution',
 'chicken_stock':'made up with water, not the dry cube',
 'vegetable_stock':'M&W only has chicken stock made up with water; stock is stock at this dilution',
 'passata':'no passata in M&W - canned tomatoes as the nearest thing',
 'frozen_berries':'no mixed berry bag in M&W - raspberries as a stand-in',
 'stir_fry_veg':'no raw frozen stir fry mix in M&W - mixed frozen veg, boiled',
 'salad_leaves':'no bagged mixed leaf in M&W - average lettuce',
 'bok_choy':'M&W only has pak choi steamed, not raw',
 'mixed_beans_drained':'no mixed bean tin in M&W - red kidney beans as the nearest',
 'chilli_oil':'no chilli oil in M&W - olive oil, which is what it mostly is',
 'mozzarella_pearls':'same cheese as the block',
 'creme_fraiche_half':'M&W half fat entry used for both',
 'tenderstem_broccoli':'no tenderstem in M&W - green broccoli',
 'cherry_tomatoes':'cherry entry used; the salad tomato key points elsewhere',
}

COOKED_ON_PURPOSE = {
 'grain_pouch':'bought as a cooked pouch','green_lentils_cooked':'bought cooked',
 'chicken_roast_meat':'raw whole bird - the basketOnly/macroOnly pair handles the yield',
 'gammon_cooked':'bought cooked','prawns_cooked':'bought cooked','ham_sliced':'bought cooked',
}

def num(v):
    if v is None: return 0.0, 'N'
    s = str(v).strip()
    if s in ('Tr','tr','trace'): return 0.0, None
    if s in ('N','n',''): return 0.0, 'N'
    s = re.sub(r'^[<>~]\s*','',s)
    try: return float(s), None
    except ValueError: return 0.0, 'N'

out = collections.OrderedDict()
out['_comment'] = ('Rebuilt from McCance and Widdowson\'s Composition of Foods Integrated Dataset 2021, '
                   'sheet "1.3 Proximates". Values are per 100g (per 100ml for liquids). source is the '
                   'M&W food code. Raw values, except where the recipe buys the thing already cooked. '
                   'Tr in M&W becomes 0; N (not determined) becomes 0 and is noted. Anything with no '
                   'sensible M&W match has no entry here and belongs in products.json.')
unmatched, table = [], []
for key in sorted(KEYS):
    code = M.get(key)
    if not code:
        unmatched.append(key); continue
    r = MW[code]
    kcal,kn = num(r['kcal']); p,pn = num(r['protein']); c,cn = num(r['carbs'])
    f,fn = num(r['fat']); fib,fibn = num(r['fibre'])
    notes = []
    if kn: notes.append('kcal N in M&W')
    if fibn: notes.append('fibre N in M&W')
    if pn: notes.append('protein N in M&W')
    e = {'per_100g':{'kcal':round(kcal),'protein':p,'carbs':c,'fat':f,'fibre':fib},
         'source':'mw:'+code,'mw_name':r['name']}
    if notes: e['note'] = ', '.join(notes)
    if key in COOKED_ON_PURPOSE: e['basis'] = COOKED_ON_PURPOSE[key]
    if key in PROXY: e['proxy'] = PROXY[key]
    out[key] = e
    table.append((key, code, r['name'], round(kcal), p, c, f, fib, ', '.join(notes)))

io.open('/tmp/foods_new.json','w',encoding='utf-8').write(json.dumps(out, ensure_ascii=False, indent=2)+'\n')
io.open('/tmp/table.json','w',encoding='utf-8').write(json.dumps({'table':table,'unmatched':unmatched}, ensure_ascii=False))
print(f'{len(table)} matched, {len(unmatched)} unmatched')
